import fsp from 'fs/promises'
import path from 'path'
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createPage } from './utils'

// Regression test: a journal file arriving from disk (e.g. background sync from
// another device) while the empty first bullet of the same journal is being
// edited must not be overwritten by the stale editor content.
test('synced journal file is not overwritten by an open empty first block',
  async ({ page, block, graphDir }) => {
    test.slow()

    // A journal page that exists in the db but has no file on disk yet,
    // like the auto-created journal of today.
    await createPage(page, 'Jan 2nd, 2031')
    const journalFile = path.join(graphDir, 'journals', '2031_01_02.md')
    await expect(fsp.access(journalFile)).rejects.toThrow()

    // createPage leaves the cursor in the empty first block
    expect(await block.isEditing()).toBe(true)

    // The file written by the other device lands on disk
    await fsp.mkdir(path.dirname(journalFile), { recursive: true })
    await fsp.writeFile(journalFile, '- hello from device A\n- second block from A\n')
    await expect(page.locator('.ls-block >> text="second block from A"'))
      .toBeVisible({ timeout: 15000 })

    // Leaving the editor must not write the stale empty value over the import
    await block.escapeEditing()
    await page.waitForTimeout(2000)

    await expect(page.locator('.ls-block >> text="hello from device A"')).toBeVisible()
    expect(await fsp.readFile(journalFile, 'utf8'))
      .toBe('- hello from device A\n- second block from A\n')
  })
