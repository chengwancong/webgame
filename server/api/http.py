"""HTTP surface. Thin: identity, ownership and payload validation, then one call.

Everything that needs an account takes it from a session token. No endpoint
accepts an account id from the request body; there is no endpoint that lets one
account reach another account's characters.
"""
from __future__ import annotations

import uuid as uuid_module
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StrictStr

from server.application import accounts, opening
from server.domain import versions
from server.infrastructure import db

NOT_AUTHENTICATED = HTTPException(status_code=401, detail='AUTHENTICATION_REQUIRED',
                                  headers={'WWW-Authenticate': 'Bearer'})


class AccountCreate(BaseModel):
    model_config = {'extra': 'forbid'}
    login: Annotated[str, Field(min_length=3, max_length=32, pattern=r'^[A-Za-z0-9_]+$')]
    password: Annotated[str, Field(min_length=12, max_length=128)]


class SessionCreate(BaseModel):
    model_config = {'extra': 'forbid'}
    login: Annotated[str, Field(min_length=3, max_length=32)]
    password: Annotated[str, Field(min_length=1, max_length=128)]


class CharacterCreate(BaseModel):
    model_config = {'extra': 'forbid'}
    command_id: StrictStr
    name: Annotated[str, Field(min_length=2, max_length=16)]


def bearer_account(authorization: Annotated[Optional[str], Header()] = None) -> int:
    """The only account source in this API: a live, unrevoked session token."""
    scheme, _, token = (authorization or '').partition(' ')
    if scheme.lower() != 'bearer' or not token.strip():
        raise NOT_AUTHENTICATED
    account_id = accounts.resolve_session(token.strip())
    if account_id is None:
        raise NOT_AUTHENTICATED
    return account_id


def create_app() -> FastAPI:
    app = FastAPI(title='abyss-walker', version=versions.versions()['client_version'])

    origins = [origin.strip() for origin in (db.env_text('ABYSS_CORS_ORIGINS') or '').split(',') if origin.strip()]
    if origins:
        # Only explicit origins are allowed, and only when configured: the Web
        # client runs on a different port than the API during checks.
        app.add_middleware(
            CORSMiddleware, allow_origins=origins, allow_credentials=False,
            allow_methods=['GET', 'POST', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])

    @app.get('/health')
    def health() -> dict:
        try:
            with db.transaction() as (conn, cur):
                cur.execute('SELECT 1 AS ok, clock_timestamp() AS at')
                row = cur.fetchone()
        except Exception as error:  # noqa: BLE001 - liveness must not hide a broken database
            raise HTTPException(status_code=503, detail={'database': 'unavailable'}) from error
        return {'status': 'ok', 'database': 'ok', 'server_time': str(row['at'])}

    @app.get('/version')
    def version() -> dict:
        return versions.versions()

    @app.post('/accounts', status_code=201)
    def post_account(body: AccountCreate) -> dict:
        return _map_value_error(accounts.create_account,
                                {'LOGIN_TAKEN': 409, 'PASSWORD_TOO_SHORT': 422},
                                body.login, body.password)

    @app.post('/sessions', status_code=201)
    def post_session(body: SessionCreate) -> dict:
        session = accounts.authenticate(body.login, body.password)
        if session is None:
            raise HTTPException(status_code=401, detail='INVALID_CREDENTIALS')
        return session

    @app.delete('/sessions/current', status_code=204)
    def delete_session(account_id: Annotated[int, Depends(bearer_account)],
                       authorization: Annotated[Optional[str], Header()] = None) -> None:
        scheme, _, token = (authorization or '').partition(' ')
        accounts.revoke_session(token.strip())

    @app.get('/characters')
    def list_characters(account_id: Annotated[int, Depends(bearer_account)]) -> dict:
        return {'characters': accounts.list_characters(account_id)}

    @app.post('/characters', status_code=201)
    def post_character(body: CharacterCreate, account_id: Annotated[int, Depends(bearer_account)]) -> dict:
        command_id = _validated_command_id(body.command_id)
        return _map_value_error(accounts.create_character,
                                {'COMMAND_CONFLICT': 409, 'NAME_LENGTH': 422, 'CHARACTER_NAME_TAKEN': 409,
                                 'ACCOUNT_NOT_FOUND': 401, 'COMMAND_RACE_UNRESOLVED': 409},
                                account_id, command_id, body.name)

    @app.get('/characters/{character_id}')
    def get_character(character_id: int, account_id: Annotated[int, Depends(bearer_account)]) -> dict:
        view = accounts.character_view(account_id, character_id)
        if view is None:
            # Deliberately identical for "missing" and "someone else's": reading
            # this endpoint must not confirm that a character id exists.
            raise HTTPException(status_code=404, detail='CHARACTER_NOT_FOUND')
        return view

    @app.get('/opening')
    def get_opening(account_id: Annotated[int, Depends(bearer_account)],
                    character_id: Annotated[int, Query(ge=1)]) -> dict:
        try:
            spec = opening.opening_spec(account_id, character_id)
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        if spec is None:
            raise HTTPException(status_code=404, detail='CHARACTER_NOT_FOUND')
        missing = [key for key in opening.SPEC_KEYS if spec.get(key) in (None, '', [], {})]
        if missing:
            raise HTTPException(status_code=503, detail={'missing_spec_keys': missing})
        return {'battle_spec': spec}

    return app


def _validated_command_id(raw: str) -> str:
    try:
        return str(uuid_module.UUID(raw))
    except (ValueError, AttributeError, TypeError) as error:
        raise HTTPException(status_code=422, detail='COMMAND_ID_INVALID') from error


def _map_value_error(function, statuses: dict, *args, **kwargs):
    try:
        return function(*args, **kwargs)
    except ValueError as error:
        detail = str(error)
        raise HTTPException(status_code=statuses.get(detail, 422), detail=detail) from error


app = create_app()
