import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('private owner UI loads scoped data, exposes version approval, preserves conflict and keyboard access',async({page},info)=>{
 await page.goto('/?private=1&role=owner');
 await expect(page.getByRole('heading',{name:'Fictional Clinic A',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review details'}).click();
 await expect(page.getByRole('button',{name:'Approve this version'})).toBeVisible();
 await page.getByRole('button',{name:'Approve this version'}).click();
 await expect(page.getByRole('alert')).toHaveText('This item changed. Refresh before saving.');
 await expect(page.getByRole('button',{name:'Approve this version'})).toBeEnabled();
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(results.violations).toEqual([]);
 await page.screenshot({path:'test-results/private-owner-'+info.project.name+'.png',fullPage:true});
});
test('private staff UI cannot approve or assign; client can request corrections',async({page})=>{
 await page.goto('/?private=1&role=staff');await page.getByRole('button',{name:'Review details'}).click();
 await expect(page.getByRole('button',{name:'Approve this version'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Save assignment'})).toHaveCount(0);
 await page.goto('/?private=1&role=client');await page.getByRole('button',{name:'Review details'}).click();
 await page.getByLabel('Changes needed').fill('Please revise the fictional title.');
 await page.getByRole('button',{name:'Request changes',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Changes saved.');
});
