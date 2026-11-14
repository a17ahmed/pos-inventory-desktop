// Retakes the design/current/ screenshot set into design/progress/<STAGE>/.
// Run through the Playwright MCP tool (browser_run_code_unsafe with `filename`) — no npm
// dependency needed. Needs the test dev server against the LOCAL backend (never production):
//   VITE_API_URL=http://localhost:3000 SENTRY_AUTH_TOKEN= npx vite --port 5178 --strictPort
// Test logins (test database only): admin admin@primemart.com, cashier primemart@ali.
// Edit STAGE before running.
async (page) => {
    const STAGE = 'stage-06';
    const BASE = 'http://localhost:5178';
    const dir = `design/progress/${STAGE}`;
    const browser = page.context().browser();
    const shot = async (p, name) => p.screenshot({ path: `${dir}/${name}.png` });

    const login = async (p, employee) => {
        await p.goto(`${BASE}/login`);
        await p.waitForTimeout(1500);
        if (employee) await p.getByText('Login as Employee instead').click();
        const inputs = p.locator('input');
        await inputs.nth(0).fill(employee ? 'primemart@ali' : 'admin@primemart.com');
        await inputs.nth(1).fill(employee ? '1234' : '12345678');
        await p.getByRole('button', { name: /sign in|login/i }).first().click();
        await p.waitForTimeout(3500);
    };

    const screens = [
        ['dashboard', '/dashboard'], ['products', '/products'], ['customers', '/customers'],
        ['receipts', '/receipts'], ['money-book', '/cashbook'], ['vendors', '/vendors'],
        ['closing', '/closing'], ['reports', '/reports'], ['settings', '/settings'],
        ['employees', '/employees'], ['expenses', '/expenses'], ['returns', '/returns'], ['inventory', '/inventory'],
    ];
    const done = [];

    // Login screen (logged out)
    const c0 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p0 = await c0.newPage();
    await p0.goto(`${BASE}/login`);
    await p0.waitForTimeout(2000);
    await shot(p0, 'light-login');
    done.push('light-login');
    await c0.close();

    // Admin screens, light + dark
    const c1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p1 = await c1.newPage();
    await login(p1, false);
    for (const theme of ['light', 'dark']) {
        await p1.evaluate((t) => localStorage.setItem('theme', t), theme);
        for (const [name, path] of screens) {
            await p1.goto(BASE + path);
            await p1.waitForTimeout(3000);
            await shot(p1, `${theme}-${name}`);
            done.push(`${theme}-${name}`);
        }
    }
    await c1.close();

    // Cashier checkout, light + dark
    const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c2.newPage();
    await login(p2, true);
    for (const theme of ['light', 'dark']) {
        await p2.evaluate((t) => localStorage.setItem('theme', t), theme);
        await p2.goto(`${BASE}/dashboard`);
        await p2.waitForTimeout(3000);
        await shot(p2, `${theme}-pos-checkout`);
        done.push(`${theme}-pos-checkout`);
    }
    await c2.close();
    return done;
}
