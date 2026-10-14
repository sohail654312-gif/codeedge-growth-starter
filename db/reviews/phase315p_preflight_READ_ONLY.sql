-- READ_ONLY sensitive-free metadata. Seven migration IDs are necessary, not sufficient.
BEGIN READ ONLY;
SELECT version(), current_database(), current_user;
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,
 a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
WHERE n.nspname IN('growth_starter','growth_starter_private') ORDER BY n.nspname,c.relname,a.attnum;
SELECT n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN('growth_starter','growth_starter_private') ORDER BY n.nspname,c.relname,k.conname;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname IN('growth_starter','growth_starter_private');
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,
 p.proconfig,r.rolname AS owner,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
WHERE n.nspname IN('growth_starter','growth_starter_private');
SELECT r.rolname,c.relname,a.attname FROM pg_roles r CROSS JOIN pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE r.rolname IN('anon','authenticated','service_role','growth_starter_reader','growth_starter_runtime')
AND n.nspname IN('growth_starter','growth_starter_private') AND has_column_privilege(r.oid,c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES');
SELECT parent.rolname AS granted_role,child.rolname AS member,m.admin_option,m.inherit_option,m.set_option
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles child ON child.oid=m.member
WHERE child.rolname LIKE 'gs315%' OR child.rolname LIKE 'growth_starter%' OR child.rolname='authenticator';
COMMIT;
