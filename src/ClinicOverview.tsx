import { ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check, CheckCircle2, ClipboardList, Clock3, ExternalLink, FileText, Globe2, Instagram, MapPin, MessageCircle, Plus, Search, ShieldCheck, Sparkles, Stethoscope, TrendingUp, Video, WandSparkles } from 'lucide-react';

type ClinicTab = 'Overview' | 'Enquiries' | 'Content studio' | 'Google & SEO' | 'Media library' | 'Settings';
type Profile = { name: string; industry: string; city: string; website: string; goal: string };
type Enquiry = { id: string; name: string; service: string; channel: string; status: string; createdAt: string };
type Work = { id: string; title: string; kind: string; notes: string; status: string; createdAt: string };
type Asset = { id: string; filename: string; url: string; mime: string; createdAt: string };

type Props = {
  demo: boolean;
  businessName: string;
  profile: Profile | null;
  enquiries: Enquiry[];
  requests: Work[];
  assets: Asset[];
  openProfile: () => void;
  openLead: () => void;
  openRequest: () => void;
  goTo: (tab: ClinicTab) => void;
};

const conceptWebsite = 'https://dr-ikram-wazir-codeedge-concept-j5vowo.v2.appdeploy.ai/';
const socialPage = 'https://www.tiktok.com/@drikraamwazir';
const demoTrend = [10, 13, 17, 16, 22, 24, 28];
const examples = [
  { icon: MessageCircle, tone: 'sky', title: 'Sample enquiry: ENT consultation', detail: 'From website concept', status: 'Example' },
  { icon: CalendarDays, tone: 'violet', title: 'Sample appointment request', detail: 'Awaiting clinic confirmation', status: 'Example' },
  { icon: Video, tone: 'rose', title: 'Rhinoplasty information reel idea', detail: 'Content suggestion for review', status: 'Draft idea' },
  { icon: Search, tone: 'green', title: 'Local SEO checklist prepared', detail: 'Bannu clinic visibility', status: 'Planned' },
];

function dateLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function chartCoordinates(values: number[]) {
  const top = 23;
  const height = 162;
  const max = Math.max(4, ...values) * 1.15;
  return values.map((v, i) => {
    const x = 22 + (i / (values.length - 1)) * 638;
    const y = top + height - (v / max) * height;
    return [x, y] as const;
  });
}

function LineChart({ values, labels }: { values: number[]; labels: string[] }) {
  const points = chartCoordinates(values);
  const line = points.map(p => p.join(',')).join(' ');
  const area = 'M ' + points[0].join(' ') + ' L ' + points.slice(1).map(p => p.join(' ')).join(' L ') + ' L 660 188 L 22 188 Z';
  return (
    <div className="clinic-chart-box">
      <svg className="clinic-chart" viewBox="0 0 682 218" role="img" aria-label="Seven-period illustrative enquiries trend chart">
        <defs>
          <linearGradient id="clinicChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3e9df6" stopOpacity=".28" />
            <stop offset="100%" stopColor="#3e9df6" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[48, 93, 140, 188].map(y => <line key={y} x1="22" x2="660" y1={y} y2={y} stroke="#e5edf7" strokeDasharray="4 5" />)}
        <path d={area} fill="url(#clinicChartFill)" />
        <polyline points={line} fill="none" stroke="#1b8af2" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x,y],i) => <circle key={i} cx={x} cy={y} r={4.5} stroke="#ffffff" strokeWidth="2" fill="#248fee" />)}
      </svg>
      <div className="clinic-chart-labels">{labels.map((label,i)=><span key={i}>{label}</span>)}</div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, note }: { icon: typeof MessageCircle; label: string; value: number; tone: string; note: string }) {
  return (
    <div className="clinic-kpi">
      <span className={'clinic-kpi-icon '+tone}><Icon size={23} strokeWidth={2.3}/></span>
      <div className="clinic-kpi-copy">
        <span className="clinic-kpi-title">{label}</span>
        <strong>{value.toLocaleString('en-GB')}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

export default function ClinicOverview({ demo, businessName, profile, enquiries, requests, assets, openProfile, openLead, openRequest, goTo }: Props) {
  const booked = enquiries.filter(x => x.status === 'Booked').length;
  const won = enquiries.filter(x => x.status === 'Won').length;
  const completed = requests.filter(x => x.status === 'Completed').length;
  const clinicName = demo ? 'Dr Ikram Wazir' : businessName;
  const now = new Date();
  const last7 = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - index));
    return d;
  });
  const actualTrend = last7.map(d => enquiries.filter(e => new Date(e.createdAt).toDateString() === d.toDateString()).length);
  const timeline = demo ? demoTrend : actualTrend;
  const labelDates = demo ? ['1 Mar','5 Mar','10 Mar','15 Mar','20 Mar','25 Mar','31 Mar'] : last7.map(dateLabel);
  const statCards = demo
    ? [
        { icon: MessageCircle, label: 'New enquiries', value: 28, tone: 'sky', note: 'Sample monthly figure' },
        { icon: CalendarDays, label: 'Appointments', value: 18, tone: 'violet', note: 'Sample monthly figure' },
        { icon: CheckCircle2, label: 'Confirmed visits', value: 14, tone: 'green', note: 'Sample monthly figure' },
        { icon: FileText, label: 'Content published', value: 12, tone: 'rose', note: 'Sample monthly figure' },
      ]
    : [
        { icon: MessageCircle, label: 'Enquiries tracked', value: enquiries.length, tone: 'sky', note: 'Your saved records' },
        { icon: CalendarDays, label: 'Marked booked', value: booked, tone: 'violet', note: 'From enquiry statuses' },
        { icon: CheckCircle2, label: 'Marked won', value: won, tone: 'green', note: 'From enquiry statuses' },
        { icon: FileText, label: 'Tasks completed', value: completed, tone: 'rose', note: 'From saved requests' },
      ];
  const allActivities = demo
    ? examples
    : [
        ...enquiries.slice(0, 5).map(e => ({ icon: MessageCircle, tone: 'sky', title: e.service, detail: e.channel + ' · ' + e.name, status: e.status, timestamp: e.createdAt })),
        ...requests.slice(0, 5).map(w => ({ icon: FileText, tone: 'violet', title: w.title, detail: w.kind, status: w.status, timestamp: w.createdAt })),
      ].sort((a,b) => (('timestamp' in b ? b.timestamp : '') || '').localeCompare(('timestamp' in a ? a.timestamp : '') || '')).slice(0,4);
  const website = demo ? conceptWebsite : (profile?.website?.startsWith('https://') || profile?.website?.startsWith('http://') ? profile.website : null);

  return (
    <div className="clinic-home">
      <div className="clinic-title-area">
        <div>
          <div className="clinic-crumb">CODEEDGE <span>/</span> {demo ? 'DOCTOR DEMONSTRATION' : 'YOUR GROWTH DASHBOARD'}</div>
          <h1>Good morning, {clinicName}! <span className="clinic-wave">✳</span></h1>
          <p>{demo ? 'A personalised preview of your clinic growth platform.' : 'Here is your business growth overview.'}</p>
        </div>
        <div className="clinic-title-action">
          <span className="clinic-date-pill"><CalendarDays size={16}/> {demo ? 'Sample month' : 'Current activity'}</span>
          <button className="clinic-outline" onClick={openProfile}>{demo ? 'Start your workspace' : 'Business profile'} <ArrowRight size={15}/></button>
        </div>
      </div>

      {demo ? <div className="clinic-demo-disclaimer"><ShieldCheck size={16}/><strong>PERSONALISED DEMO</strong><span>All numbers, enquiries and activities below are fictional examples, not Dr Ikram Wazir's real clinic results.</span></div> : !profile && <div className="clinic-demo-disclaimer"><Sparkles size={16}/><strong>GET STARTED</strong><span>Add your business profile to personalise your private workspace.</span><button onClick={openProfile}>Add details <ArrowRight size={13}/></button></div>}

      <div className="clinic-kpis">{statCards.map(card => <KpiCard key={card.label} {...card}/>)}</div>
      <div className="clinic-middle">
        <section className="clinic-panel clinic-growth-panel">
          <div className="clinic-panel-head"><div><h2>{demo ? 'Patient enquiries & growth' : 'Enquiries over the last 7 days'}</h2><p>{demo ? 'A concept of how the clinic could track incoming interest.' : 'Calculated from enquiries saved in this workspace.'}</p></div><span className="clinic-mini-pill"><BarChart3 size={14}/> Enquiries</span></div>
          <div className="clinic-chart-count"><span><strong>{demo ? '28' : enquiries.length}</strong> {demo ? 'example enquiries' : 'tracked enquiries'}</span><span className="clinic-trend-note"><TrendingUp size={16}/> {demo ? 'Illustrative chart' : 'Your recorded activity'}</span></div>
          <LineChart values={timeline} labels={labelDates}/>
        </section>
        <section className="clinic-panel clinic-activity-panel">
          <div className="clinic-panel-head"><div><h2>Recent activity</h2><p>{demo ? 'Example clinic workflow' : 'Latest saved enquiries & requests'}</p></div><button onClick={() => goTo('Enquiries')} className="clinic-text-action">View all <ArrowRight size={14}/></button></div>
          <div className="clinic-activity-list">{allActivities.length > 0 ? allActivities.map((act,i) => {
            const Icon=act.icon;
            return <div key={i} className="clinic-activity">
              <span className={'clinic-activity-icon '+act.tone}><Icon size={18}/></span>
              <div><strong>{act.title}</strong><small>{act.detail}</small></div>
              <span className={'clinic-activity-status '+(demo ? 'example' : '')}>{act.status}</span>
            </div>;
          }) : <div className="clinic-activity-empty">Your activity will appear here as enquiries and requests are added.</div>}</div>
          <button className="clinic-activity-add" onClick={openLead}><Plus size={15}/> Record a new enquiry</button>
        </section>
      </div>

      <div className="clinic-feature-grid">
        <section className="clinic-feature-card">
          <div className="clinic-feature-head"><span className="clinic-feature-icon sky"><Globe2 size={20}/></span><strong>Website status</strong><span className="clinic-feature-label">{demo ? 'Concept ready' : (website ? 'Linked' : 'Not linked')}</span></div>
          <p>{demo ? 'A polished ENT and rhinoplasty website concept prepared for Dr Ikram Wazir.' : (website ? 'Your website link is saved in your business profile.' : 'Add your website URL to your business profile.')}</p>
          <div className="clinic-site-preview"><span className="clinic-site-top"><i/><i/><i/><small>CODEEDGE CLINIC CONCEPT</small></span><strong>Clearer care.<br/>Better first impressions.</strong><small>{demo ? 'ENT · Rhinoplasty · Bannu' : businessName}</small><span className="clinic-site-swoosh"/></div>
          {website ? <a className="clinic-feature-link" href={website} target="_blank" rel="noopener noreferrer">View website <ExternalLink size={15}/></a> : <button className="clinic-feature-link" onClick={openProfile}>Add website <ArrowRight size={15}/></button>}
        </section>

        <section className="clinic-feature-card">
          <div className="clinic-feature-head"><span className="clinic-feature-icon rose"><Instagram size={20}/></span><strong>Social media</strong><span className="clinic-feature-label">{demo ? 'Content ideas' : 'Planning'}</span></div>
          <p>{demo ? 'Patient-friendly education around ENT health, nose and sinus care, and rhinoplasty.' : 'Send genuine photos and content requests for the Codeedge team.'}</p>
          <div className="clinic-post-grid"><div className="post-card post-one"><Stethoscope size={26}/><span>ENT CARE</span></div><div className="post-card post-two"><WandSparkles size={25}/><span>CLINIC TIPS</span></div><div className="post-card post-three"><Video size={25}/><span>SHORT VIDEOS</span></div></div>
          {demo ? <a className="clinic-feature-link" href={socialPage} target="_blank" rel="noopener noreferrer">View TikTok profile <ExternalLink size={15}/></a> : <button className="clinic-feature-link" onClick={() => goTo('Content studio')}>Open content studio <ArrowRight size={15}/></button>}
        </section>

        <section className="clinic-feature-card">
          <div className="clinic-feature-head"><span className="clinic-feature-icon multi"><Search size={20}/></span><strong>Google visibility</strong><span className="clinic-feature-label muted">Not connected</span></div>
          <p>{demo ? 'A plan to help people searching for ENT and rhinoplasty services in Bannu find the clinic.' : 'Google analytics and Business Profile are not connected yet.'}</p>
          <div className="clinic-google-preview"><span>Growth opportunity</span><strong>Local discovery</strong><div className="clinic-bars">{[35,48,58,76,91].map((height,i)=><i key={i} style={{height:height+'%'}} />)}</div><small>{demo ? 'Illustration only' : 'Tracking integration planned'}</small></div>
          <button className="clinic-feature-link" onClick={() => goTo('Google & SEO')}>View SEO roadmap <ArrowRight size={15}/></button>
        </section>

        <section className="clinic-feature-card">
          <div className="clinic-feature-head"><span className="clinic-feature-icon violet"><Sparkles size={20}/></span><strong>AI growth manager</strong><span className="clinic-feature-label muted">Concept</span></div>
          <p>Planned Codeedge assistance for smarter content ideas, enquiry reviews and approval workflows.</p>
          <div className="clinic-ai-list"><span><Check size={15}/> Clinic-specific content suggestions</span><span><Check size={15}/> Opportunity review with evidence</span><span><Check size={15}/> Human approval before publishing</span></div>
          <button className="clinic-feature-link" onClick={openRequest}>Suggest a growth task <ArrowRight size={15}/></button>
        </section>
      </div>

      <div className="clinic-lower-actions">
        <div><span className="clinic-lower-icon"><MapPin size={20}/></span><div><strong>{demo ? 'Dr Ikram Wazir · ENT & Rhinoplasty' : businessName}</strong><p>{demo ? 'Bannu, Khyber Pakhtunkhwa · Peshawar expansion not confirmed' : (profile?.city || 'Add your location') + ' · Your private Codeedge workspace'}</p></div></div>
        <button onClick={() => goTo('Enquiries')}>Explore enquiries <ArrowUpRight size={17}/></button>
      </div>
      <div className="clinic-explanation"><ShieldCheck size={15}/> This is a Codeedge client proposal/demo, not an official clinic dashboard. No actual clinic appointments, Google metrics or AI assistants are connected.</div>
    </div>
  );
}
