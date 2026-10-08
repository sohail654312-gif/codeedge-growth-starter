import { db, storage, router, json, error, requireAuth } from '@appdeploy/sdk';

type Profile = {
  name: string;
  industry: string;
  city: string;
  website: string;
  goal: string;
  updatedAt: string;
};
type Enquiry = {
  name: string;
  service: string;
  channel: string;
  status: string;
  createdAt: string;
};
type Request = {
  title: string;
  kind: string;
  notes: string;
  status: string;
  createdAt: string;
};
type Asset = {
  filename: string;
  mime: string;
  path: string;
  createdAt: string;
};
const table = (kind: string, userId: string) => 'gs_' + kind + '_' + userId;
const strings = (v: unknown, max = 150) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
const allowedStatuses = ['New', 'Contacted', 'Booked', 'Won', 'Lost'];

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ status: 'ok' })],
  'GET /api/overview': [
    requireAuth(),
    async ctx => {
      const uid = ctx.user!.userId;
      const [profiles, enquiries, requests, assets] = await Promise.all([
        db.list<Profile>(table('profiles', uid), { limit: 1 }),
        db.list<Enquiry>(table('enquiries', uid), { limit: 50 }),
        db.list<Request>(table('requests', uid), { limit: 50 }),
        db.list<Asset>(table('assets', uid), { limit: 24 }),
      ]);
      const assetRows = await Promise.all(
        assets.items.map(async asset => {
          const [signed] = await storage.url([asset.path]);
          return { ...asset, url: signed?.url || '' };
        })
      );
      return json({
        profile: profiles.items[0] || null,
        enquiries: enquiries.items,
        requests: requests.items,
        assets: assetRows,
      });
    },
  ],
  'POST /api/profile': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Record<string, unknown> | null;
      const name = strings(body?.name, 90),
        industry = strings(body?.industry, 60),
        city = strings(body?.city, 90);
      if (!name || !industry || !city)
        return error('Business name, industry and city are required.', 400);
      const data: Profile = {
        name,
        industry,
        city,
        website: strings(body?.website, 250),
        goal: strings(body?.goal, 240),
        updatedAt: new Date().toISOString(),
      };
      const key = table('profiles', ctx.user!.userId);
      const previous = await db.list<Profile>(key, { limit: 1 });
      if (previous.items.length) {
        const [ok] = await db.update(key, [
          { id: previous.items[0].id, record: data },
        ]);
        if (!ok) return error('Could not save profile.', 500);
        return json({ ...data, id: previous.items[0].id });
      }
      const [id] = await db.add(key, [data]);
      if (!id) return error('Could not save profile.', 500);
      return json({ ...data, id });
    },
  ],
  'POST /api/enquiries': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Record<string, unknown> | null;
      const name = strings(body?.name, 100),
        service = strings(body?.service, 100);
      const channel = strings(body?.channel, 30) || 'Website';
      if (!name || !service)
        return error('Name and requested service are required.', 400);
      if (
        ![
          'Website',
          'WhatsApp',
          'Instagram',
          'Google',
          'Phone',
          'Other',
        ].includes(channel)
      )
        return error('Invalid channel.', 400);
      const data: Enquiry = {
        name,
        service,
        channel,
        status: 'New',
        createdAt: new Date().toISOString(),
      };
      const [id] = await db.add(table('enquiries', ctx.user!.userId), [data]);
      if (!id) return error('Could not add enquiry.', 500);
      return json({ ...data, id }, 201);
    },
  ],
  'PUT /api/enquiries/:id': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Record<string, unknown> | null;
      const status = strings(body?.status, 20);
      if (!allowedStatuses.includes(status))
        return error('Invalid status.', 400);
      const key = table('enquiries', ctx.user!.userId);
      const [original] = await db.get<Enquiry>(key, [ctx.params.id]);
      if (!original) return error('Enquiry not found.', 404);
      const [ok] = await db.update(key, [
        { id: ctx.params.id, record: { ...original, status } },
      ]);
      return ok
        ? json({ ...original, status, id: ctx.params.id })
        : error('Could not update.', 500);
    },
  ],
  'POST /api/requests': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Record<string, unknown> | null;
      const title = strings(body?.title, 100),
        kind = strings(body?.kind, 40),
        notes = strings(body?.notes, 600);
      if (
        !title ||
        !['Social content', 'Website update', 'Local SEO', 'Other'].includes(
          kind
        )
      )
        return error('Title and a valid request type are required.', 400);
      const data: Request = {
        title,
        kind,
        notes,
        status: 'Requested',
        createdAt: new Date().toISOString(),
      };
      const [id] = await db.add(table('requests', ctx.user!.userId), [data]);
      if (!id) return error('Could not create request.', 500);
      return json({ ...data, id }, 201);
    },
  ],
  'POST /api/assets': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as Record<string, unknown> | null;
      const filename = strings(body?.filename, 110),
        mime = strings(body?.mime, 40),
        content = body?.content;
      const types: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
      };
      if (
        !filename ||
        !types[mime] ||
        typeof content !== 'string' ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(content) ||
        content.length > 4200000
      ) {
        return error('Choose a PNG, JPG or WebP image under 3 MB.', 400);
      }
      const path =
        'growth-starter/' +
        ctx.user!.userId +
        '/' +
        crypto.randomUUID() +
        '.' +
        types[mime];
      const [saved] = await storage.write([
        { path, content, contentType: mime },
      ]);
      if (!saved) return error('Could not upload image.', 500);
      const data: Asset = {
        filename,
        mime,
        path,
        createdAt: new Date().toISOString(),
      };
      const [id] = await db.add(table('assets', ctx.user!.userId), [data]);
      if (!id) {
        await storage.delete([path]);
        return error('Could not record uploaded image.', 500);
      }
      const [signed] = await storage.url([path]);
      return json({ ...data, id, url: signed?.url || '' }, 201);
    },
  ],
});
