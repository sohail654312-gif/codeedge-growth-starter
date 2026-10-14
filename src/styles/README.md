The existing hand-written UI does not use Tailwind utility classes or `@apply`.
Its Tailwind 3.4.19 CSS reset is preserved here verbatim, under the adjacent MIT
license, so removing the unused build-time Tailwind dependency preserves layout.
The build dependency transitively pulled unpatched `braces` (GHSA-vfj7-8cjw-p6xm)
and an outdated selector parser. Static reset CSS does not execute those tools.
Source: `tailwindcss@3.4.19/src/css/preflight.css` from the installed npm package.
