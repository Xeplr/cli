# __NAME__ — development settings.
#
# Ports: __UI_PORT__ ui · __AUTH_PORT__ auth · __API_PORT__ api

NODE_ENV=development
LOG_DIR=./logs

# ── API service ──
__PREFIX___PORT=__API_PORT__

# ── Shared ──
# Locks and unlocks the database connections below. Generated for you; keep it.
# Lose it and the connection strings below have to be made again.
ENCRYPTION_KEY=__ENCRYPTION_KEY__

__CONNECTION_NOTE__
__PREFIX___CONNECTION=__DB_CONNECTION__
AUTH_DB_CONNECTION_INFO_ENCRYPTED=__DB_CONNECTION__

# ── Databases ──
# Three of them: accounts, your own data, and flows (workflow's own, kept apart
# from yours). The first two are created by the setup; the flows one by the API
# the first time it starts.
DB_API=__DB_API__
AUTH_DB_NAME=__DB_AUTH__
DB_WORKFLOW=__DB_WORKFLOW__

# ── Sign-in service ──
#
# Sessions are kept in REDIS, which must be running. Defaults to
# localhost:6379; set REDIS_HOST / REDIS_PORT to point elsewhere. Without it
# the service refuses to start and says so — rather than letting every login
# succeed and every request afterwards fail as "Invalid or expired token".
#
# REDIS_PREFIX keeps this app's keys apart from any other app on the same
# Redis. Required, and unique per app: two apps sharing one see each other's
# menus and permissions.
REDIS_PREFIX=__NAME__:
AUTH_PORT=__AUTH_PORT__
AUTH_JWT_SECRET=__JWT_SECRET__

# Where the sign-in service is. Your API asks it to check every token.
AUTH_URL=http://localhost:__AUTH_PORT__

# Sign-in setup files: the screens' permissions (@xeplr/factory's), flows'
# (@xeplr/workflow-api's), then this app's own — menu entries and anything else
# it adds. Comma-separated, in order.
XEPLR_AUTH_MIGRATIONS=./node_modules/@xeplr/factory/migrations-auth,./node_modules/@xeplr/workflow-api/migrations-auth,./migrations-auth

# ── The first account you sign in with ──
# Created for you when you set up the database. Change the password here and
# delete the account to reset it.
AUTH_SUPER_ADMIN_EMAIL=__ADMIN_EMAIL__
AUTH_SUPER_ADMIN_PASSWORD=__ADMIN_PASSWORD__

# ── Which company a role belongs to ──
# none: this app has one set of roles for everyone. A multi-tenant app names
# the header that carries the company id instead (e.g. x-company-id), so a
# role made inside a company belongs to that company.
AUTH_TENANT_HEADER=none

# ── Links that go out in emails ──
# FULLY QUALIFIED, and they point at UI pages rather than at the API. The
# sign-in service builds these links and appends the token as ?token=... — an
# email template can carry a token as a value but cannot build an address.
AUTH_ACTIVATION_URL=http://localhost:__UI_PORT__/auth/activate
AUTH_INVITE_URL=http://localhost:__UI_PORT__/auth/accept-invite
# Never taken from the request: a link built from its Host header could point
# a real user's reset mail at someone else's site. Unset, reset is refused.
AUTH_RESET_URL=http://localhost:__UI_PORT__/auth/reset-password

# ── The role a new sign-up gets ──
# Given when the account is activated. Without a role a person can sign in
# and do nothing — not even open their own profile. No default: unset, or a
# role that does not exist, and registration is refused. Comma-separate for
# more than one; Super Admin is never allowed here.
AUTH_REGISTER_ROLES=Viewer

# ── Uploaded files ──
# Where a form's FILE field puts what people upload. The path is what the
# record stores; the file itself is served only through the API's own route,
# which checks the caller the way reading a record does. Relative to api/.
FACTORY_FILES_DIR=./uploads/factory

# ── Email ──
# Needed for anyone but the super admin to get in: registration, resending an
# activation link, invites and password reset all send a link, and each is
# refused while email does not work — no half-made accounts. Signing in keeps
# working without it. The sign-in service checks it at start and says so in
# its banner: "email ✓ smtp — host:587, connected" or "✗ NOT WORKING — reason".
# Providers: smtp | brevo | aws | azure — see @xeplr/utils' README.
# EMAIL_PROVIDER=smtp
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=
