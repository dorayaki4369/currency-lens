# Currency Lens Privacy Policy

Effective date: October 25, 2026

Currency Lens is a browser extension for Chrome and Firefox that converts prices you select on a web page into the currencies you choose. This policy explains what information the extension handles and where it goes.

## Text you select on web pages

When you select text, Currency Lens looks for a price in it on your device. The selected text and the content of the pages you visit are never sent to us or to anyone else.

## Settings stored in your browser

Your target currencies, display theme, and currency symbol preferences are stored with the browser's `storage.sync` API. If you have turned on sync in Chrome or Firefox, your browser syncs these settings through your Google or Mozilla account. We cannot access them.

The most recently downloaded exchange rates are stored on your device with the browser's `storage.local` API so that conversions keep working when you are offline.

## Exchange-rate requests

The extension periodically downloads public exchange-rate data from our API at `https://cl.dryk.net`. These requests contain no information about you, your settings, or the pages you visit.

The API runs on Cloudflare Workers, and the exchange rates come from Open Exchange Rates. As with any request on the internet, Cloudflare receives your IP address and standard request information such as your browser's user agent. This information may be kept for a limited period in operational logs, which we use only to keep the service running and to investigate failures.

## What we do not do

- We do not collect personal information, browsing history, or the content of web pages.
- We do not use analytics, advertising, or tracking.
- We do not sell or share any information with third parties.

## Changes to this policy

If this policy changes, we will update this page and its effective date.

## Contact

If you have questions about this policy, contact Ryuya Hirayama at ryuya.hirayama@dryk.net.
