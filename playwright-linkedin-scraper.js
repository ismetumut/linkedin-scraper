const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Cookie dosyasının yolu
const COOKIES_PATH = path.resolve(__dirname, 'linkedin-cookies.json');

async function manualLoginAndSaveCookies() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/login');

    console.log('Lütfen giriş yapın, CAPTCHA/SMS gelirse çözün ve ardından Enter tuşuna basın...');
    await page.pause();

    // Giriş sonrası cookie’leri kaydet
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('Cookie kaydedildi!');
    await browser.close();
}

async function loginWithSavedCookiesAndFetchConnections() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Cookie dosyası var mı kontrol et
    if (fs.existsSync(COOKIES_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
        await context.addCookies(cookies);
    } else {
        console.error('Önce manuel giriş yapıp cookie kaydetmelisiniz.');
        process.exit(1);
    }

    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/');

    await page.waitForTimeout(5000);

    // Bağlantıları topla
    const connections = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('a.mn-connection-card__link').forEach(el => {
            const name = el.querySelector('.mn-connection-card__name')?.innerText?.trim();
            const profile = el.href;
            result.push({ name, profile });
        });
        return result;
    });

    // Sonucu CSV olarak kaydet
    const csv = ["name,profile"].concat(
        connections.map(c => `"${c.name}","${c.profile}"`)
    ).join("\n");
    fs.writeFileSync('linkedin-connections.csv', csv);
    console.log(`Bağlantılar çekildi! Toplam: ${connections.length}. CSV olarak kaydedildi.`);
    await browser.close();
}

(async () => {
    if (!fs.existsSync(COOKIES_PATH)) {
        await manualLoginAndSaveCookies();
    }
    await loginWithSavedCookiesAndFetchConnections();
})();
