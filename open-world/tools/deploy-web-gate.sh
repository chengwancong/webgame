#!/usr/bin/env bash
set -eu
release=$1
archive_hash=$2
source_commit=$3
mode=$4
stage=/home/ubuntu/abyss/gate-releases/$release
mkdir -p "$stage"
test "$(sha256sum /tmp/$release.tgz | cut -d' ' -f1)" = "$archive_hash"
tar -xzf "/tmp/$release.tgz" -C "$stage"
cd /home/ubuntu/abyss/open-world/deploy
sha256sum Caddyfile compose.yaml > "$stage/before.sha256"
cp Caddyfile "$stage/Caddyfile.before"
cp compose.yaml "$stage/compose.yaml.before"
docker build -t "abyss-staging-web-gate:$release" -f "$stage/deploy/web-gate/Dockerfile" "$stage"
python3 - "$stage" <<'PY'
import sys,json,subprocess,pathlib,secrets
p=pathlib.Path(sys.argv[1])
raw=json.loads(subprocess.check_output(['docker','inspect','abyss-staging-caddy-1']))[0]['Config']['Env']
env=dict(x.split('=',1) for x in raw)
password=secrets.token_hex(20)
hashed=subprocess.check_output(['docker','run','--rm','caddy:2','caddy','hash-password','--plaintext',password],text=True).strip()
values={'AW_DOMAIN':env['AW_DOMAIN'],'AW_GATE_USER':'gate_test','AW_GATE_HASH':hashed,'AW_GATE_SESSION_KEY':secrets.token_hex(32),'AW_GATE_VERIFIER':'http://aw-caddy-check:8081/verify','GATE_TEST_VERIFIER':'http://aw-caddy-check:8081/verify','GATE_TEST_USER':'gate_test','GATE_TEST_PASSWORD':password,'GATE_ROUTER_BASE':'http://aw-caddy-check:8085'}
(p/'check.env').write_text(''.join(k+'='+v+'\n' for k,v in values.items()))
(p/'check.env').chmod(0o600)
config=(p/'deploy/Caddyfile').read_text().replace('{$AW_DOMAIN}', 'http://:8085').replace('web-gate:8080','aw-gate-check:8080').replace('api:8611','abyss-staging-api-1:8611')
(p/'Caddyfile.check').write_text(config)
PY
# The shared deployment lock guarantees these names cannot belong to another run.
# Do not remove a preexisting container without investigating its owner.
test -z "$(docker ps -aq --filter name='^/aw-gate-check$')"
test -z "$(docker ps -aq --filter name='^/aw-caddy-check$')"
cleanup() { docker rm -f aw-gate-check aw-caddy-check >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name aw-caddy-check --network abyss-staging_default --env-file "$stage/check.env" -v "$stage/Caddyfile.check:/etc/caddy/Caddyfile:ro" caddy:2
docker run -d --name aw-gate-check --network abyss-staging_default --env-file "$stage/check.env" "abyss-staging-web-gate:$release"
for n in $(seq 1 20); do
 if docker exec aw-gate-check node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then break; fi
 sleep 1
done
docker exec aw-gate-check node /gate/test.mjs
docker exec aw-gate-check node /gate/router-test.mjs
if [ "$mode" = check ]; then exit 0; fi
cd /home/ubuntu/abyss/open-world/deploy
sha256sum -c "$stage/before.sha256"
python3 - <<'PY'
import pathlib,secrets
p=pathlib.Path('.env');s=p.read_text()
if not any(line.startswith('AW_GATE_SESSION_KEY=') and len(line.split('=',1)[1].strip())>=64 for line in s.splitlines()):
 s='\n'.join(line for line in s.splitlines() if not line.startswith('AW_GATE_SESSION_KEY='))+'\nAW_GATE_SESSION_KEY='+secrets.token_hex(32)+'\n'
 p.write_text(s);p.chmod(0o600)
PY
old_gate=$(docker images -q abyss-staging-web-gate:latest)
if [ -n "$old_gate" ]; then docker tag "$old_gate" "abyss-staging-web-gate:before-$release"; fi
rollback() {
 code=$?
 if [ "$code" -ne 0 ]; then
  cat "$stage/Caddyfile.before" > Caddyfile
  cp "$stage/compose.yaml.before" compose.yaml
  if [ -n "$old_gate" ]; then
   docker tag "$old_gate" abyss-staging-web-gate:latest
   docker compose up -d --no-deps --no-build --force-recreate web-gate
  fi
  docker compose up -d --no-deps --no-build --force-recreate caddy
 fi
 cleanup
 exit "$code"
}
trap rollback EXIT
cp "$stage/deploy/compose.yaml" compose.yaml
mkdir -p web-gate
cp "$stage/deploy/web-gate/"* web-gate/
docker tag "abyss-staging-web-gate:$release" abyss-staging-web-gate:latest
docker compose up -d --no-deps --no-build web-gate
for n in $(seq 1 20); do
 if docker compose exec -T web-gate node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then break; fi
 sleep 1
done
# Keep the mounted inode; Caddy validates and reloads without stopping API/DB.
docker cp "$stage/deploy/Caddyfile" abyss-staging-caddy-1:/tmp/Caddyfile.candidate
docker exec abyss-staging-caddy-1 caddy validate --config /tmp/Caddyfile.candidate --adapter caddyfile
cat "$stage/deploy/Caddyfile" > Caddyfile
if [ "$(stat -c '%d:%i' Caddyfile)" = "$(docker exec abyss-staging-caddy-1 stat -c '%d:%i' /etc/caddy/Caddyfile)" ]; then
 docker exec abyss-staging-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
else
 # An earlier game release replaced open-world while Caddy retained its old inode.
 docker compose up -d --no-deps --no-build --force-recreate caddy
fi
for n in $(seq 1 20); do
 if curl --fail --silent https://43-165-179-11.sslip.io/__gate/login > "$stage/login-after.html"; then break; fi
 sleep 1
done
curl --fail --silent --show-error https://43-165-179-11.sslip.io/__gate/login > "$stage/login-after.html"
curl --fail --silent --show-error https://43-165-179-11.sslip.io/api/health > "$stage/health-after.json"
grep -q 'name="password"' "$stage/login-after.html"
printf '%s\n' "$source_commit" > WEB_GATE_SOURCE_COMMIT
echo "WEB_GATE_DEPLOYED $release"
trap cleanup EXIT
