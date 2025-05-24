const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: "ok", message: "Railway'de çalışıyor!" });
});

app.post('/api/scrape', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email ve password zorunlu!" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.goto('https://www.linkedin.com/login');
    await page.type('input#username', email, { delay: 50 });
    await page.type('input#password', password, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/');
    await page.waitForSelector('.mn-connection-card__details', { timeout: 10000 });

    const connections = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.mn-connection-card__details'));
      return cards.map(card => ({
        name: card.querySelector('.mn-connection-card__name')?.innerText.trim(),
        title: card.querySelector('.mn-connection-card__occupation')?.innerText.trim(),
      }));
    });

    await browser.close();
    res.json({ connections });
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: "LinkedIn scraping failed.", details: err.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

