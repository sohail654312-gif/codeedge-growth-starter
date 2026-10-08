import { useEffect, useState } from 'react';
import { auth, api } from '@appdeploy/client';
import ClinicOverview from './ClinicOverview';
import WorkProgress from './WorkProgress';
import {WebsitePage,AgencyDesk} from './ServicePages';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CloudUpload,
  FileText,
  Globe2,
  Instagram,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';

type Profile = {
  name: string;
  industry: string;
  city: string;
  website: string;
  goal: string;
  id?: string;
};
type Enquiry = {
  id: string;
  name: string;
  service: string;
  channel: string;
  status: string;
  createdAt: string;
};
type Work = {
  id: string;
  title: string;
  kind: string;
  notes: string;
  status: string;
  createdAt: string;
};
type Asset = {
  id: string;
  filename: string;
  url: string;
  mime: string;
  createdAt: string;
};
type Overview = {
  profile: Profile | null;
  enquiries: Enquiry[];
  requests: Work[];
  assets: Asset[];
  role?: 'owner' | 'agency_admin' | 'staff' | 'client';
  workspaceId?: string;
};
type Tab =
  | 'Overview'
  | 'Website'
  | 'Agency desk'
  | 'Enquiries'
  | 'Content studio'
  | 'Google & SEO'
  | 'Media library'
  | 'Settings';
type Modal = 'lead' | 'request' | 'profile' | null;
const sample: Overview = {
  profile: {
    name: 'Dr Ikram Wazir',
    industry: 'ENT & Rhinoplasty',
    city: 'Bannu',
    website: 'https://dr-ikram-wazir-codeedge-concept-j5vowo.v2.appdeploy.ai/',
    goal: 'Grow ethical ENT and rhinoplasty enquiries with clearer online information',
  },
  enquiries: [
    {
      id: 'a',
      name: 'Sample enquiry 01',
      service: 'ENT consultation',
      channel: 'Instagram',
      status: 'New',
      createdAt: '2026-10-08T09:25:00Z',
    },
    {
      id: 'b',
      name: 'Sample enquiry 02',
      service: 'Rhinoplasty information',
      channel: 'Website',
      status: 'Contacted',
      createdAt: '2026-10-07T10:00:00Z',
    },
    {
      id: 'c',
      name: 'Sample enquiry 03',
      service: 'Sinus consultation',
      channel: 'WhatsApp',
      status: 'Booked',
      createdAt: '2026-10-06T11:00:00Z',
    },
    {
      id: 'd',
      name: 'Sample enquiry 04',
      service: 'ENT consultation',
      channel: 'Google',
      status: 'Won',
      createdAt: '2026-10-05T09:00:00Z',
    },
    {
      id: 'e',
      name: 'Sample enquiry 05',
      service: 'Rhinoplasty',
      channel: 'Website',
      status: 'Booked',
      createdAt: '2026-10-04T09:00:00Z',
    },
  ],
  requests: [
    {
      id: 'r1',
      title: 'ENT care short-video ideas',
      kind: 'Social content',
      notes: '',
      status: 'In progress',
      createdAt: '2026-10-04T09:00:00Z',
    },
    {
      id: 'r2',
      title: 'Bannu ENT search visibility plan',
      kind: 'Local SEO',
      notes: '',
      status: 'Requested',
      createdAt: '2026-10-02T09:00:00Z',
    },
    {
      id: 'r3',
      title: 'Review clinic website concept',
      kind: 'Website update',
      notes: '',
      status: 'Completed',
      createdAt: '2026-09-30T09:00:00Z',
    },
  ],
  assets: [],
};
const nav: { name: Tab; icon: typeof Activity }[] = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Website', icon: Globe2 },
  { name: 'Enquiries', icon: MessageCircle },
  { name: 'Content studio', icon: WandSparkles },
  { name: 'Google & SEO', icon: Globe2 },
  { name: 'Media library', icon: Camera },
  { name: 'Agency desk', icon: Users },
  { name: 'Settings', icon: Settings },
];
const datestr = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
function Logo() {
  return (
    <div className="logo">
      <div className="logo-mark">
        <span>C</span>
        <i />
      </div>
      <div className="logo-words">
        <strong>
          codeedge<span>.</span>
        </strong>
        <small>GROWTH STARTER</small>
      </div>
    </div>
  );
}
function App() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [demo, setDemo] = useState(true);
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(
    null
  );
  const [data, setData] = useState<Overview>(sample);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [lead, setLead] = useState({
    name: '',
    service: '',
    channel: 'Website',
  });
  const [work, setWork] = useState({
    title: '',
    kind: 'Social content',
    notes: '',
  });
  const [profile, setProfile] = useState({
    name: '',
    industry: 'Medical practice',
    city: '',
    website: '',
    goal: '',
  });
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mediaConfirmed, setMediaConfirmed] = useState(false);

  const flash = (message: string) => {
    setNotice(message);
  };
  async function refresh() {
    const result = await api.get('/api/overview');
    const next = result.data as Overview;
    setData(next);
    if (next.profile) setProfile({ ...next.profile });
  }
  useEffect(() => {
    let active = true;
    async function initialise() {
      try {
        const current = await auth.getUser();
        if (!active || !current) return;
        setUser({ name: current.name, email: current.email });
        setDemo(false);
        const response = await api.get('/api/overview');
        if (active) {
          const overview = response.data as Overview;
          setData(overview);
          if (overview.profile) setProfile({ ...overview.profile });
        }
      } catch {
        if (active) setNotice('Could not load your workspace. Try refreshing.');
      }
    }
    initialise();
    return () => {
      active = false;
    };
  }, []);
  async function signIn() {
    setBusy(true);
    setNotice('');
    try {
      const { user: current } = await auth.signIn();
      setUser({ name: current.name, email: current.email });
      setDemo(false);
      await refresh();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'popup_closed')
        flash(
          code === 'popup_blocked'
            ? 'Please allow sign-in popups.'
            : 'Sign-in was not completed.'
        );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    await auth.signOut();
    setUser(null);
    setDemo(true);
    setData(sample);
    setTab('Overview');
    setModal(null);
    flash('You are viewing the sample workspace.');
  }
  const guard = (next: Modal) => {
    setNotice('');
    if (demo) {
      flash('Sample mode is read-only. Sign in to use your private workspace.');
      return;
    }
    setModal(next);
  };
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await api.post('/api/profile', profile);
      await refresh();
      setModal(null);
      flash('Business profile saved.');
    } catch (e) {
      flash(
        'Could not save profile: ' +
          String(
            (e as { response?: { data?: { error?: string } } }).response?.data
              ?.error || 'please check the fields.'
          )
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveLead(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await api.post('/api/enquiries', lead);
      await refresh();
      setLead({ name: '', service: '', channel: 'Website' });
      setModal(null);
      setTab('Enquiries');
      flash('Enquiry recorded.');
    } catch {
      flash('Could not add enquiry. Check the name and service.');
    } finally {
      setBusy(false);
    }
  }
  async function saveWork(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await api.post('/api/requests', work);
      await refresh();
      setWork({ title: '', kind: 'Social content', notes: '' });
      setModal(null);
      setTab('Content studio');
      flash('Request sent to the Codeedge queue.');
    } catch {
      flash('Could not submit your request.');
    } finally {
      setBusy(false);
    }
  }
  async function requestCorrection(original: Work, notes: string) {
    if (demo) { flash('Sign in to request changes.'); return false; }
    const safeNotes = notes.trim();
    if (safeNotes.length < 4 || safeNotes.length > 500) { flash('Please describe the change in 4 to 500 characters.'); return false; }
    try {
      await api.post('/api/requests', {
        title: ('Change request: ' + original.title).slice(0, 100),
        kind: original.kind,
        notes: safeNotes,
      });
      await refresh();
      flash('Your correction was added as a separate tracked request.');
      return true;
    } catch {
      flash('Could not submit the correction. Please try again.');
      return false;
    }
  }
  async function updateStatus(id: string, status: string) {
    if (demo) {
      flash('Sign in to update enquiries.');
      return;
    }
    try {
      await api.put('/api/enquiries/' + encodeURIComponent(id), { status });
      await refresh();
      flash('Enquiry updated.');
    } catch {
      flash('Could not update enquiry.');
    }
  }
  async function uploadImage(file?: File) {
    if (!file) return;
    if(!mediaConfirmed) { flash('Confirm that you own the media rights and it contains no patient information.'); return; }
    if (demo) {
      flash('Sign in to upload images.');
      return;
    }
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 3 * 1024 * 1024
    ) {
      flash('Choose a PNG, JPG or WebP under 3 MB.');
      return;
    }
    setUploading(true);
    setNotice('');
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
      });
      await api.post('/api/assets', {
        filename: file.name,
        mime: file.type,
        content,
      });
      await refresh();
      flash('Image saved privately. Preview access stays locked until consent and safety review.');
      setMediaConfirmed(false);
    } catch {
      flash('Upload failed. Please try a smaller image.');
    } finally {
      setUploading(false);
    }
  }
  const enquiries = [...data.enquiries].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const requests = [...data.requests].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const bookings = enquiries.filter(
    e => e.status === 'Booked' || e.status === 'Won'
  ).length;
  const active = requests.filter(r => r.status !== 'Completed').length;
  const currentName = data.profile?.name || 'Your business';
  const cards = [
    {
      title: 'Total enquiries',
      value: enquiries.length,
      icon: MessageCircle,
      desc: demo ? '+18% vs last month' : 'Logged in your workspace',
      tone: 'blue',
    },
    {
      title: 'Bookings & wins',
      value: bookings,
      icon: CalendarDays,
      desc: 'From recorded enquiries',
      tone: 'green',
    },
    {
      title: 'Growth tasks',
      value: active,
      icon: Sparkles,
      desc: 'Requested or in progress',
      tone: 'violet',
    },
    {
      title: 'Media uploaded',
      value: data.assets.length,
      icon: Camera,
      desc: 'Your saved brand assets',
      tone: 'orange',
    },
  ];
  const visibleNav = nav.filter(item => item.name !== 'Agency desk' || (!demo && (data.role === 'agency_admin' || data.role === 'staff')));
  const rows = enquiries.filter(e =>
    [e.name, e.service, e.channel]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="workspace-pill">
          <div className="ws-avatar">
            <Activity size={18} />
          </div>
          <div>
            <strong>{currentName}</strong>
            <span>{demo ? 'Example clinic' : 'Private workspace'}</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-heading">WORKSPACE</div>
        <nav>
          {visibleNav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={'nav-item ' + (tab === name ? 'selected' : '')}
              onClick={() => {
                setTab(name);
                setNotice('');
              }}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === 'Enquiries' &&
                enquiries.some(e => e.status === 'New') && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {demo ? (
            <div className="doctor-sidebar-card">
              <div className="doctor-avatar">IW</div>
              <strong>Dr Ikram Wazir</strong>
              <span>ENT &amp; Rhinoplasty Surgeon</span>
              <span>Bannu, Khyber Pakhtunkhwa</span>
              <div className="sidebar-card-divider" />
              <small>YOUR CODEEDGE GROWTH PARTNER</small>
              <p>More visibility. Better enquiries. Simpler growth.</p>
              <a
                href="https://dr-ikram-wazir-codeedge-concept-j5vowo.v2.appdeploy.ai/"
                target="_blank"
                rel="noopener noreferrer"
              >
                View website concept <ArrowRight size={14} />
              </a>
            </div>
          ) : (
            <div className="sidebar-help">
              <div className="help-icon"><Sparkles size={20} /></div>
              <strong>Here to help you grow</strong>
              <p>Codeedge handles the complicated stuff. You focus on your customers.</p>
              <button onClick={() => guard('request')}>
                Request something <ArrowRight size={15} />
              </button>
            </div>
          )}
        <div className="sidebar-footer">
            <div className="mini-avatar">
              {(user?.name || 'G').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{user?.name || 'Guest preview'}</strong>
              <span>{demo ? 'Explore the demo' : 'Signed in securely'}</span>
            </div>
            {!demo && (
              <button title="Sign out" onClick={signOut}>
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="mobile-brand">
            <Logo />
          </div>
          <div className="crumb">
            Codeedge <span>/</span> <strong>{tab}</strong>
          </div>
          <div className="top-actions">
            <span className={'mode-tag ' + (demo ? 'mode-demo' : 'mode-live')}>
              <i />
              {demo ? 'DEMO WORKSPACE' : 'PRIVATE WORKSPACE'}
            </span>
            <button
              className="round-icon"
              title="Help"
              onClick={() =>
                flash('Need help? Send a growth request from Content studio.')
              }
            >
              <CircleHelp size={19} />
            </button>
            {demo ? (
              <button className="signin" onClick={signIn} disabled={busy}>
                <LockKeyhole size={16} /> Sign in
              </button>
            ) : (
              <div className="user-dot" title={user?.email}>
                {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="mobile-tabs">
          {visibleNav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={name === tab ? 'active' : ''}
              onClick={() => setTab(name)}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </div>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        )}
        <div className="page">
          {tab === 'Overview' && (
            <ClinicOverview
              demo={demo}
              businessName={currentName}
              profile={data.profile}
              enquiries={enquiries}
              requests={requests}
              assets={data.assets}
              openProfile={() => guard('profile')}
              openLead={() => guard('lead')}
              openRequest={() => guard('request')}
              goTo={setTab}
            />
          )}
          {tab === 'Website' && (
            <WebsitePage
              business={currentName}
              website={data.profile?.website || ''}
              requests={requests}
              demo={demo}
              onWebsiteEdit={() => guard('profile')}
              onRequest={() => {setWork({title:'',kind:'Website update',notes:''});guard('request');}}
            />
          )}
          {tab === 'Agency desk' && !demo && (data.role === 'agency_admin' || data.role === 'staff') && (
            <AgencyDesk role={data.role} requests={requests} assets={data.assets}/>
          )}
          {tab === 'Enquiries' && (
            <>
              <PageHeading
                eyebrow="LEADS & CONVERSATIONS"
                title="Every enquiry matters."
                desc="A simple list of the people who reached out to your business."
              />
              <div className="section-actions">
                <div className="searchbox">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search enquiries..."
                    aria-label="Search enquiries"
                  />
                </div>
                <button
                  className="primary-button"
                  onClick={() => guard('lead')}
                >
                  <Plus size={17} /> Add enquiry
                </button>
              </div>
              <section className="panel table-panel">
                <div className="responsive-table">
                  <table>
                    <thead>
                      <tr>
                        <th>PERSON</th>
                        <th>SERVICE</th>
                        <th>CHANNEL</th>
                        <th>DATE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.id}>
                          <td>
                            <div className="person-cell">
                              <span className={'lead-avatar lead-' + (i % 3)}>
                                {r.name[0]}
                              </span>
                              <strong>{r.name}</strong>
                            </div>
                          </td>
                          <td>{r.service}</td>
                          <td>
                            <span className="channel">
                              <MessageCircle size={14} />
                              {r.channel}
                            </span>
                          </td>
                          <td>{datestr(r.createdAt)}</td>
                          <td>
                            {demo ? (
                              <span
                                className={
                                  'status status-' + r.status.toLowerCase()
                                }
                              >
                                {r.status}
                              </span>
                            ) : (
                              <select
                                aria-label={'Status for ' + r.name}
                                value={r.status}
                                onChange={e =>
                                  updateStatus(r.id, e.target.value)
                                }
                              >
                                {[
                                  'New',
                                  'Contacted',
                                  'Booked',
                                  'Won',
                                  'Lost',
                                ].map(s => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length === 0 && (
                    <div className="empty-small">
                      No matching enquiries yet.
                    </div>
                  )}
                </div>
              </section>
              <div className="tip-line">
                <ShieldCheck size={17} /> Keep sensitive medical details outside
                this early-stage enquiry tracker.
              </div>
            </>
          )}
          {tab === 'Content studio' && (
            <>
              <PageHeading
                eyebrow="CONTENT & CAMPAIGNS"
                title="Your content, handled."
                desc="Share an idea or request. The Codeedge team handles the creative work."
              />
              <div className="studio-hero">
                <div>
                  <div className="eyebrow white">CONTENT MADE SIMPLE</div>
                  <h2>
                    You bring the story.
                    <br />
                    We make it stand out.
                  </h2>
                  <p>
                    Photos, short videos, educational posts and local content
                    built around your business.
                  </p>
                  <button
                    className="white-button"
                    onClick={() => guard('request')}
                  >
                    Request content <ArrowRight size={17} />
                  </button>
                </div>
                <div className="hero-art">
                  <div className="art-card art-card-one">
                    <Instagram size={24} />
                    <span>Social content</span>
                  </div>
                  <div className="art-card art-card-two">
                    <Sparkles size={22} />
                    <span>Made for your brand</span>
                  </div>
                </div>
              </div>
              <WorkProgress
                requests={requests}
                demo={demo}
                role={data.role}
                onNewRequest={() => guard('request')}
                onCorrection={requestCorrection}
              />
              <div className="panel content-board">
                <div className="panel-header">
                  <div>
                    <h2>Your requests</h2>
                    <p>Ideas and tasks submitted to Codeedge</p>
                  </div>
                  <span className="pill-subtle">{requests.length} total</span>
                </div>
                {requests.map(r => (
                  <div className="request-line" key={r.id}>
                    <div className="request-symbol">
                      <WandSparkles size={18} />
                    </div>
                    <div>
                      <strong>{r.title}</strong>
                      <p>
                        {r.kind}
                        {r.notes ? ' · ' + r.notes : ''}
                      </p>
                    </div>
                    <span className="task-status">{r.status}</span>
                  </div>
                ))}
                {requests.length === 0 && (
                  <div className="empty-state">
                    <WandSparkles size={25} />
                    <strong>No content requests yet</strong>
                    <p>Share what you'd like Codeedge to create or improve.</p>
                  </div>
                )}
                <button className="panel-link" onClick={() => guard('request')}>
                  <Plus size={16} /> Add a request
                </button>
              </div>
            </>
          )}
          {tab === 'Google & SEO' && (
            <>
              <PageHeading
                eyebrow="SEARCH VISIBILITY"
                title="Be found where it matters."
                desc="Your website, local SEO and answer-engine visibility in one clear plan."
              />
              <div className="seo-banner">
                <Globe2 size={32} />
                <div>
                  <strong>Local growth, without the jargon</strong>
                  <p>
                    Codeedge works on the website, Google Business Profile,
                    relevant service pages and helpful answers. Connected data
                    comes in later phases.
                  </p>
                </div>
              </div>
              <div className="seo-grid">
                {[
                  {
                    icon: Globe2,
                    title: 'Website presence',
                    desc: 'A fast, mobile-friendly site built to convert visitors into enquiries.',
                    badge: 'STEP 01',
                  },
                  {
                    icon: Search,
                    title: 'Google & local SEO',
                    desc: 'Clear services, local search pages, helpful information and review strategy.',
                    badge: 'STEP 02',
                  },
                  {
                    icon: Sparkles,
                    title: 'AEO readiness',
                    desc: 'Answer real customer questions with structured, useful content.',
                    badge: 'STEP 03',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Measure growth',
                    desc: 'Track source enquiries and bookings; connect verified analytics later.',
                    badge: 'STEP 04',
                  },
                ].map(item => (
                  <div className="seo-card" key={item.title}>
                    <div className="seo-icon">
                      <item.icon size={22} />
                    </div>
                    <small>{item.badge}</small>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="tip-line">
                <ShieldCheck size={17} /> Google rankings, views, and SEO
                performance are not connected to this preview. No live figures
                are claimed.
              </div>
              <button
                className="primary-button"
                onClick={() => guard('request')}
              >
                Request an SEO task <ArrowRight size={16} />
              </button>
            </>
          )}
          {tab === 'Media library' && (
            <>
              <PageHeading
                eyebrow="YOUR BRAND ASSETS"
                title="Your photos, one home."
                desc="Share authentic business photos so the team can create content that looks like you."
              />
              <div className="upload-zone">
                <div className="upload-symbol">
                  <CloudUpload size={26} />
                </div>
                <h3>Share photos with Codeedge</h3>
                <p>
                  Upload PNG, JPG or WebP images up to 3 MB each. Video uploads
                  are planned for a later phase.
                </p>
                <label className="media-consent-check">
                  <input type="checkbox" checked={mediaConfirmed}
                    onChange={e => setMediaConfirmed(e.target.checked)} />
                  <span>I confirm I have permission to share these business images and they contain no patient or medical data.</span>
                </label>
                <label className="primary-button upload-control">
                  <CloudUpload size={17} />
                  {uploading ? 'Uploading...' : 'Choose a photo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading || !mediaConfirmed}
                    onChange={e => {
                      void uploadImage(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <h2 className="library-title">
                Your images <span>{data.assets.length}</span>
              </h2>
              {data.assets.length ? (
                <div className="assets-grid">
                  {data.assets.map(a => (
                    <div className="asset-tile" key={a.id}>
                      {a.url ? <img src={a.url} alt={a.filename} loading="lazy" /> : (
                        <div className="locked-media" role="status">
                          <LockKeyhole size={20} />
                          <span>Awaiting consent and security review</span>
                        </div>
                      )}
                      <strong title={a.filename}>{a.filename}</strong>
                      <small>{datestr(a.createdAt)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Camera size={26} />
                  <strong>Ready when you are</strong>
                  <p>Images you share securely will appear here.</p>
                </div>
              )}
            </>
          )}
          {tab === 'Settings' && (
            <>
              <PageHeading
                eyebrow="WORKSPACE SETTINGS"
                title="Business details."
                desc="Just the essentials. No confusing setup screens."
              />
              <div className="panel settings-panel">
                <div className="settings-row">
                  <div className="settings-icon">
                    <UserRound size={21} />
                  </div>
                  <div>
                    <strong>Business information</strong>
                    <span>
                      {data.profile
                        ? data.profile.name + ' · ' + data.profile.city
                        : 'Not set up yet'}
                    </span>
                  </div>
                  <button
                    className="outline-button"
                    onClick={() => guard('profile')}
                  >
                    Edit details
                  </button>
                </div>
                <div className="settings-row">
                  <div className="settings-icon">
                    <LockKeyhole size={21} />
                  </div>
                  <div>
                    <strong>Workspace access</strong>
                    <span>
                      {demo
                        ? 'Sample workspace · no live business data'
                        : user?.email || 'Personal authenticated workspace'}
                    </span>
                  </div>
                  <span className="status status-booked">
                    {demo ? 'Sample' : 'Protected'}
                  </span>
                </div>
                <div className="settings-row">
                  <div className="settings-icon">
                    <ShieldCheck size={21} />
                  </div>
                  <div>
                    <strong>Service connections</strong>
                    <span>
                      Business OS, CIGO, Google and social APIs require
                      verified, permission-scoped integrations.
                    </span>
                  </div>
                  <span className="status status-new">Not connected</span>
                </div>
              </div>
              {demo ? (
                <button className="primary-button" onClick={signIn}>
                  Sign in to start <ArrowRight size={16} />
                </button>
              ) : (
                <button className="outline-button" onClick={signOut}>
                  <LogOut size={16} /> Sign out
                </button>
              )}
            </>
          )}
        </div>
        <footer className="main-footer">
          © 2026 Codeedge. Built for growth, not complexity.{' '}
          <span>Growth Starter · Phase 1</span>
        </footer>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <div className="dialog-head">
              <div>
                <div className="eyebrow">CODEEDGE GROWTH STARTER</div>
                <h2 id="dialog-title">
                  {modal === 'profile'
                    ? 'Your business details'
                    : modal === 'lead'
                      ? 'Add an enquiry'
                      : 'Make a growth request'}
                </h2>
              </div>
              <button
                className="round-icon"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <form
              onSubmit={
                modal === 'profile'
                  ? saveProfile
                  : modal === 'lead'
                    ? saveLead
                    : saveWork
              }
            >
              {modal === 'profile' && (
                <>
                  <label>
                    Business name *
                    <input
                      required
                      value={profile.name}
                      onChange={e =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                      placeholder="e.g. Aesthetica Clinic"
                    />
                  </label>
                  <div className="form-columns">
                    <label>
                      Industry *
                      <select
                        required
                        value={profile.industry}
                        onChange={e =>
                          setProfile({ ...profile, industry: e.target.value })
                        }
                      >
                        <option>ENT & Rhinoplasty</option>
                        <option>Aesthetic clinic</option>
                        <option>Medical practice</option>
                        <option>Plumbing & heating</option>
                        <option>Construction</option>
                        <option>Salon & beauty</option>
                        <option>Local services</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label>
                      City *
                      <input
                        required
                        value={profile.city}
                        onChange={e =>
                          setProfile({ ...profile, city: e.target.value })
                        }
                        placeholder="e.g. Peshawar"
                      />
                    </label>
                  </div>
                  <label>
                    Website (optional)
                    <input
                      value={profile.website}
                      onChange={e =>
                        setProfile({ ...profile, website: e.target.value })
                      }
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    Your main goal
                    <textarea
                      rows={2}
                      value={profile.goal}
                      onChange={e =>
                        setProfile({ ...profile, goal: e.target.value })
                      }
                      placeholder="e.g. More consultations from Google"
                    />
                  </label>
                </>
              )}
              {modal === 'lead' && (
                <>
                  <label>
                    Enquirer name *
                    <input
                      required
                      value={lead.name}
                      onChange={e => setLead({ ...lead, name: e.target.value })}
                      placeholder="e.g. Ayesha K."
                    />
                  </label>
                  <label>
                    Interested service *
                    <input
                      required
                      value={lead.service}
                      onChange={e =>
                        setLead({ ...lead, service: e.target.value })
                      }
                      placeholder="e.g. Skin consultation"
                    />
                  </label>
                  <label>
                    Where did they find you?
                    <select
                      value={lead.channel}
                      onChange={e =>
                        setLead({ ...lead, channel: e.target.value })
                      }
                    >
                      {[
                        'Website',
                        'WhatsApp',
                        'Instagram',
                        'Google',
                        'Phone',
                        'Other',
                      ].map(x => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <p className="form-help">
                    Please do not enter medical histories or sensitive patient
                    details.
                  </p>
                </>
              )}
              {modal === 'request' && (
                <>
                  <label>
                    What would you like us to do? *
                    <input
                      required
                      value={work.title}
                      onChange={e =>
                        setWork({ ...work, title: e.target.value })
                      }
                      placeholder="e.g. Create 3 Instagram posts"
                    />
                  </label>
                  <label>
                    Request type
                    <select
                      value={work.kind}
                      onChange={e => setWork({ ...work, kind: e.target.value })}
                    >
                      {[
                        'Social content',
                        'Website update',
                        'Local SEO',
                        'Other',
                      ].map(x => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Additional details
                    <textarea
                      rows={4}
                      value={work.notes}
                      onChange={e =>
                        setWork({ ...work, notes: e.target.value })
                      }
                      placeholder="Share your idea, goal, or instructions..."
                    />
                  </label>
                </>
              )}
              <div className="dialog-actions">
                <button
                  className="outline-button"
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? 'Saving...'
                    : modal === 'request'
                      ? 'Send request'
                      : 'Save changes'}{' '}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">
        <span className="eyebrow-dot" />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
  );
}
export default App;
