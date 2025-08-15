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

        # Type the chatbot command and send the message
        await page.get_by_placeholder("Type a message...").fill("#askme hello")
        await page.get_by_role("button", name="Send").click()

        # Wait for the chatbot's response to appear
        await expect(page.locator("text=This is a placeholder response")).to_be_visible()

        # Take a screenshot to verify
        await page.screenshot(path="jules-scratch/chatbot_verification/chatbot_verification.png")

        await browser.close()

asyncio.run(main())
