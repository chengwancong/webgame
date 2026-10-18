"""Player controls must change the real core input, while pause preserves it."""
from tests.conftest import godot_run


def test_pause_manual_skill_cooldown_and_result_use_the_real_core(tmp_path):
    result = godot_run(
        'presentation-controls', 'res://tests/presentation_controls.gd',
        expect_pattern=r'PRESENTATION_CONTROLS_OK \{', timeout_seconds=30,
        max_output_bytes=100_000, log_file=str(tmp_path / 'controls.log'))
    assert result.ok, result.reason + '\n' + result.stdout[-2000:] + result.stderr[-2000:]
