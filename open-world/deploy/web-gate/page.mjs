export function loginPage(csrf, message = '') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>测试服访问验证 · 深渊行者</title>
<link rel="stylesheet" href="/__gate/style.css"></head><body><main>
<p class="eyebrow">深渊行者 · 测试服</p><h1>验证后，开始冒险</h1>
<p class="description">请输入测试服访问用户名和口令。验证通过后，再登录你的游戏账号。</p>
<form method="post" action="/__gate/login">
<input type="hidden" name="csrf" value="${csrf}">
<label for="username">访问用户名</label><input id="username" name="username" autocomplete="username" maxlength="128" required autofocus>
<label for="password">访问口令</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="512" required>
<p class="error" role="alert">${message}</p><button type="submit">验证并进入游戏</button>
</form><p class="note">本次访问有效期为 12 小时。请沿用同一浏览器会话。</p>
</main></body></html>`;
}

export const layoutCss = `
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:var(--space-4);background:var(--color-background);color:var(--color-text-primary);font-family:var(--font-family);font-size:var(--font-size-body);line-height:var(--font-line-body)}
main{width:100%;max-width:30rem;padding:var(--space-6);background:var(--color-panel);border:var(--border-width) solid var(--color-border);border-radius:var(--radius-panel);box-shadow:var(--shadow-panel)}
h1{font-size:var(--font-size-h1);margin:var(--space-3) 0}.eyebrow{font-weight:var(--font-weight-semibold);margin:0}.description,.note{color:var(--color-text-secondary)}
form{display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-5)}label{font-weight:var(--font-weight-semibold)}input,button{font:inherit;border-radius:var(--radius-control);min-height:var(--size-control);padding:var(--space-3);border:var(--border-width) solid var(--color-border)}
input{width:100%;background:var(--color-panel-raised);color:var(--color-text-primary)}button{background:var(--color-primary);color:var(--color-primary-text);border-color:var(--color-primary-border);font-weight:var(--font-weight-semibold);cursor:pointer}button:hover{background:var(--color-primary-hover)}button:active{background:var(--color-primary-pressed)}
input:focus-visible,button:focus-visible{outline:2px solid var(--color-primary-border);outline-offset:2px}.error{min-height:var(--size-control);margin:0;color:var(--color-danger);overflow-wrap:anywhere}.note{font-size:var(--font-size-caption);margin-bottom:0}
`;
