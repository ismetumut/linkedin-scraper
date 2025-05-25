import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email ve şifre zorunlu!" }, { status: 400 });
  }

  const puppeteer = require('puppeteer');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto('https://www.linkedin.com/login');
    await page.type('input#username', email, { delay: 50 });
    await page.type('input#password', password, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', { waitUntil: "networkidle2" });
    await page.waitForSelector('.mn-connection-card__details', { timeout: 10000 });

    const connections = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.mn-connection-card__details')).map(card => ({
        name: card.querySelector('.mn-connection-card__name')?.innerText.trim(),
        title: card.querySelector('.mn-connection-card__occupation')?.innerText.trim(),
      }));
    });

    await browser.close();
    return NextResponse.json({ connections });
  } catch (err: any) {
    if (browser) await browser.close();
    return NextResponse.json({ error: "LinkedIn scraping failed.", details: err.toString() }, { status: 500 });
  }
}
