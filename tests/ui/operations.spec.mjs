import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('loaded requests are bounded, searchable, filtered and paginated at mobile and desktop widths',async({page})=>{
 await page.goto('/');await expect(page.locator('.work-item')).toHaveCount(8);
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.locator('.work-pagination')).toContainText('Page 2');
 await page.getByLabel('Search loaded requests').fill('Fictional task 0999');await expect(page.locator('.work-item')).toHaveCount(1);
 await expect(page.locator('.work-pagination')).toContainText('1 matches in 1000 loaded requests');
 await page.getByLabel('Search loaded requests').fill('');await page.getByLabel('Status',{exact:true}).selectOption('Awaiting approval');
 await expect(page.locator('.work-state').first()).toHaveText('Awaiting approval');
 await page.getByLabel('Sort',{exact:true}).selectOption('title');await expect(page.locator('.work-item-name h3').first()).toHaveText('Fictional task 0000');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('correction failures stay visible, agency controls stay disabled, and no unhandled promise occurs',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Request a correction',exact:true}).first().click();await page.getByLabel('What should Codeedge change?').fill('Revise the fictional headline');
 await page.getByRole('button',{name:'Send change request'}).click();await expect(page.getByRole('alert')).toHaveText('The change request could not be saved. Please try again.');
 expect(errors).toEqual([]);await page.goto('/?role=staff');await expect(page.getByRole('button',{name:'Request a correction',exact:true}).first()).toBeDisabled();
});
test('schema, calendar and duplicate tabs clearly retain offline evidence and pass automated accessibility checks',async({page})=>{
 await page.goto('/');
 for(const [name,heading] of [['Schema drafts','Structured data for owner review'],['Content calendar','A proposed content calendar'],['Duplicate review','Review similar supplied extracts']]){
  await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name:heading})).toBeVisible();
  const results=await new AxeBuilder({page}).include('.pci').include('.work-panel').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
});
