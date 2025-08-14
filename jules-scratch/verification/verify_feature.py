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

        # Initial screenshot
        await page.screenshot(path="jules-scratch/verification/verification_initial.png")

        # Toggle chat
        await page.get_by_role("button", name="Toggle Chat").click()
        await page.wait_for_timeout(500) # wait for animation
        await page.screenshot(path="jules-scratch/verification/verification_no_chat.png")

        # Toggle video
        await page.get_by_role("button", name="Toggle Video").click()
        await page.wait_for_timeout(500) # wait for animation
        await page.screenshot(path="jules-scratch/verification/verification_no_chat_no_video.png")

        # Toggle chat back on
        await page.get_by_role("button", name="Toggle Chat").click()
        await page.wait_for_timeout(500) # wait for animation
        await page.screenshot(path="jules-scratch/verification/verification_no_video.png")

        # Toggle video back on
        await page.get_by_role("button", name="Toggle Video").click()
        await page.wait_for_timeout(500) # wait for animation
        await page.screenshot(path="jules-scratch/verification/verification_all.png")

        await browser.close()

asyncio.run(main())
