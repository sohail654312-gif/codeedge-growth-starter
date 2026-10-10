import type {SeoBusiness,HtmlFixture,SeoReport} from './seo-growth.mjs';
export const FICTIONAL_SEO_FIXTURES:Readonly<Record<'plumbing'|'clinic',{business:SeoBusiness;pages:HtmlFixture[]}>>;
export function demoGrowthReport(kind?:'plumbing'|'clinic',asOf?:string):SeoReport;
