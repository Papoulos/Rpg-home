import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        await page.goto("http://localhost:3000")

        # Wait for the main layout to be visible
        await expect(page.locator(".app-layout")).to_be_visible()

        # Close the modal if it appears
        modal_button = page.get_by_role("button", name="Save")
        if await modal_button.is_visible():
            await page.get_by_label("Username").fill("testuser")
            await page.get_by_label("Avatar URL").fill("http://example.com/avatar.png")
            await modal_button.click()

        # Wait for modal to disappear
        await expect(modal_button).not_to_be_visible()

        # Take a screenshot of the redesigned page
        await page.screenshot(path="jules-scratch/redesign_verification/redesign_verification.png")

        await browser.close()

asyncio.run(main())
