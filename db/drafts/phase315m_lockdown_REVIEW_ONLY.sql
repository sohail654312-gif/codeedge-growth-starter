-- Reviewed security-first recovery proposal; NOT applied hosted.
BEGIN;
ALTER ROLE gs315m_issuer NOLOGIN;
ALTER ROLE gs315k_gateway NOLOGIN;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA growth_starter_private FROM gs315m_issuer,gs315k_gateway;
REVOKE ALL ON SCHEMA growth_starter_private FROM gs315m_issuer,gs315k_gateway;
-- Also close old bypass paths after approved cutover; never regrant them.
-- Operator applies the existing exact Phase315J legacy cutover and its
-- assertions separately after validating baseline dependencies.
COMMIT;
