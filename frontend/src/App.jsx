import { useEffect, useRef, useState } from 'react';
import './print-options.css';
import { Activity, Bell, Check, Clock3, FileText, Files, Globe2, Home, Languages, LoaderCircle, Printer, Settings, Upload, Wifi, X, History, CircleHelp } from 'lucide-react';

const labels = {
  th: { home:'ภาพรวม', print:'พิมพ์เอกสาร', queue:'งานที่รอพิมพ์', history:'ประวัติการพิมพ์', printers:'เครื่องพิมพ์', settings:'ตั้งค่า', help:'ช่วยเหลือ', greet:'พร้อมพิมพ์งานหรือยัง?', subtitle:'อัปโหลดไฟล์ แล้วสั่งพิมพ์ผ่าน Epson L3210 ได้จากอุปกรณ์นี้', choose:'เลือกไฟล์', supported:'รองรับ PNG, JPG, PDF และเอกสาร Office (สูงสุด 50 MB)', recent:'ไฟล์ล่าสุด', empty:'ยังไม่มีไฟล์', upload:'อัปโหลดไฟล์', uploading:'กำลังอัปโหลด…', uploaded:'อัปโหลดแล้ว', printBtn:'พิมพ์', printing:'กำลังส่งงานพิมพ์…', submitted:'ส่งงานพิมพ์แล้ว', ready:'พร้อมใช้งาน', printerStatus:'สถานะเครื่องพิมพ์', noQueue:'ไม่มีงานที่รอพิมพ์', noHistory:'ยังไม่มีประวัติการพิมพ์', refresh:'ตรวจสอบอีกครั้ง', notice:'เลือกไฟล์ PNG, JPG, PDF หรือเอกสาร Office ก่อนสั่งพิมพ์', setup:'เครื่องพิมพ์ที่ตรวจพบ', status:'สถานะ', size:'ขนาด', time:'เวลา', settingsText:'ไฟล์และประวัติการพิมพ์จะถูกเก็บไว้บนเซิร์ฟเวอร์ และยังอยู่หลังรีเฟรชหน้าเว็บ', helpText:'อัปโหลด PNG/JPG เพื่อดูตัวอย่างภาพ แล้วกดพิมพ์ หรือใช้ PDF และเอกสาร Office', failed:'เกิดข้อผิดพลาด', delete:'ลบรายการ' },
  en: { home:'Dashboard', print:'Print files', queue:'Print queue', history:'Print history', printers:'Printers', settings:'Settings', help:'Help', greet:'Ready to print?', subtitle:'Upload a file and print to your Epson L3210 from this device', choose:'Choose files', supported:'PNG, JPG, PDF and Office documents (up to 50 MB)', recent:'Recent files', empty:'No files yet', upload:'Upload files', uploading:'Uploading…', uploaded:'Uploaded', printBtn:'Print', printing:'Sending print job…', submitted:'Print job submitted', ready:'Ready', printerStatus:'Printer status', noQueue:'No pending jobs', noHistory:'No print history yet', refresh:'Refresh status', notice:'Choose a PNG, JPG, PDF or Office document to print', setup:'Detected printers', status:'Status', size:'Size', time:'Time', settingsText:'Files and print history are stored on the server and remain after refreshing the page.', helpText:'Upload a PNG/JPG to preview and print it, or use a PDF or Office document.', failed:'Something went wrong', delete:'Remove item' }
};
const accept = '.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff,.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp';
const nav = [['home',Home],['print',Files],['queue',Clock3],['history',History],['printers',Printer],['settings',Settings],['help',CircleHelp]];
function formatSize(bytes=0) { return bytes < 1024*1024 ? (bytes/1024).toFixed(0)+' KB' : (bytes/1024/1024).toFixed(2)+' MB'; }
function formatTime(value) { if (!value) return '—'; try { return new Date(value).toLocaleString(); } catch { return value; } }
function validPageRange(value) { return value.split(',').every(part => { const pieces=part.trim().split('-'); if (pieces.length>2 || pieces.some(x=>x.trim()==='' || !Number.isInteger(Number(x)))) return false; const n=pieces.map(Number); return n.every(x=>x>=1) && (n.length===1 || n[0]<=n[1]); }); }

export default function App() {
  const [lang,setLang] = useState('th');
  const [page,setPage] = useState('home');
  const [printer,setPrinter] = useState(null);
  const [jobs,setJobs] = useState([]);
  const [busy,setBusy] = useState(false);
  const [printing,setPrinting] = useState('');
  const [selectedJob,setSelectedJob] = useState(null);
  const [printOptions,setPrintOptions] = useState({pages:'all',copies:1,paper_size:'A4',color_mode:'color',pages_per_sheet:1,orientation:'portrait',scaling:'fit',page_border:'none'});
  const [notice,setNotice] = useState('');
  const input = useRef(null);
  const t = labels[lang];

  async function refresh() {
    try {
      const [p,j] = await Promise.all([fetch('/api/printers'),fetch('/api/jobs')]);
      if (p.ok) setPrinter(await p.json());
      if (j.ok) { const data = await j.json(); setJobs(Array.isArray(data.jobs) ? data.jobs : []); }
    } catch { setNotice(lang === 'th' ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' : 'Cannot connect to server'); }
  }
  useEffect(() => { refresh(); }, []);
  async function upload(filesList) {
    const files = Array.from(filesList || []);
    if (!files.length) return;
    setBusy(true); setNotice('');
    for (const file of files) {
      const data = new FormData(); data.append('file',file);
      try {
        const res = await fetch('/api/uploads',{method:'POST',body:data});
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail || t.failed);
      } catch (err) { setNotice(file.name+': '+err.message); }
    }
    await refresh(); setBusy(false);
  }
  async function printJob(job, options = printOptions) {
    if (!job.can_print_now || !job.preview_url) {
      setNotice(lang === 'th' ? 'ไฟล์นี้ยังสั่งพิมพ์ไม่ได้ กรุณาใช้ PNG, JPG, PDF หรือเอกสาร Office' : 'This file cannot be printed yet. Use PNG, JPG, PDF or an Office document.');
      return;
    }
    setPrinting(job.id); setNotice('');
    try {
      const res = await fetch('/api/print/'+job.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)});
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || t.failed);
      setNotice((body.message || t.submitted)+' · '+(lang==='th'?'หน้า':'Pages')+': '+(body.print_options?.pages || 'all')+' · '+(lang==='th'?'สำเนา':'Copies')+': '+(body.print_options?.copies || 1)); setSelectedJob(null); await refresh();
    } catch (err) { setNotice(err.message); }
    finally { setPrinting(''); }
  }
  const configured = Boolean(printer?.configured);
  const shownJobs = page === 'queue' ? jobs.filter(j => j.status !== 'submitted') : page === 'history' ? jobs.filter(j => j.status === 'submitted') : jobs;
  const title = t[page] || t.home;

  function jobList(items) {
    if (!items.length) return <div className="empty"><div><Files size={25}/></div><b>{page === 'queue' ? t.noQueue : page === 'history' ? t.noHistory : t.empty}</b></div>;
    return <div className="job-list">{items.map(job => <article className="job" key={job.id}>
      <div className="file-type doc"><FileText size={19}/></div>
      <div className="job-name"><b>{job.name}</b><small>{formatSize(job.size)} · {job.extension?.replace('.','').toUpperCase()} · {job.status === 'submitted' ? (lang==='th'?'ส่งแล้ว · พิมพ์ซ้ำได้':'Submitted · Reprint available') : (lang==='th'?'บันทึกแล้ว':'Saved')}</small></div>
      <button className="primary" disabled={printing === job.id || !job.can_print_now || !job.preview_url} onClick={() => {setSelectedJob(job);setPrintOptions({pages:'all',copies:1,paper_size:'A4',color_mode:'color',pages_per_sheet:1,orientation:'portrait',scaling:'fit',page_border:'none'});setNotice('');}}>{printing === job.id ? <LoaderCircle className="spin" size={15}/> : <Printer size={15}/>} {t.printBtn}</button>
    </article>)}</div>;
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Printer size={22}/></div><div><b>PrintHub</b><small>PRINT MADE SIMPLE</small></div></div>
      <div className="side-label">{lang === 'th' ? 'เมนูหลัก' : 'MENU'}</div>
      <nav>{nav.map(([key,Icon]) => <button key={key} className={'nav-item '+(page===key?'active':'')} onClick={() => {setPage(key);setNotice(''); if(key==='printers') refresh();}}><Icon size={18}/><span>{t[key]}</span></button>)}</nav>
      <div className="side-bottom"><div className="side-promo"><Printer size={18}/><b>Epson L3210</b><p>{configured ? t.ready : (lang==='th'?'กำลังตรวจสอบเครื่องพิมพ์':'Checking printer')}</p></div><div className="profile"><div className="avatar">P</div><div><b>PrintHub</b><small>{lang==='th'?'เครื่องพิมพ์ในบ้าน':'Home printer'}</small></div></div></div>
    </aside>
    <main>
      <header className="topbar"><div className="crumb">{title}<span>/</span><b>PrintHub</b></div><div className="top-actions"><div className={'system '+(printer?.cups_running?'good':'')}><i/> {printer?.cups_running ? t.ready : (lang==='th'?'กำลังเชื่อมต่อ':'Connecting')}</div><button className="lang-btn" onClick={()=>setLang(lang==='th'?'en':'th')}><Globe2 size={16}/>{lang==='th'?'ไทย':'English'}<Languages size={14}/></button></div></header>
      <div className="content">
        {page === 'home' && <>
          <section className="welcome"><div><div className="eyebrow"><Activity size={14}/> PRINT HUB</div><h1>{t.greet}</h1><p>{t.subtitle}</p></div><div className="hero-art"><div className="hero-printer"><Printer size={45}/></div></div></section>
          <section className="stats"><article className="stat"><div className="stat-icon blue"><Printer size={19}/></div><div className="stat-label">{t.printers}</div><strong className="stat-value">{printer?.printers?.length ?? '—'}</strong><div className="stat-detail">{configured ? t.ready : '—'}</div></article><article className="stat"><div className="stat-icon purple"><Clock3 size={19}/></div><div className="stat-label">{t.queue}</div><strong className="stat-value">{jobs.filter(j=>j.status!=='submitted').length}</strong><div className="stat-detail">{t.uploaded}</div></article><article className="stat"><div className="stat-icon green"><Check size={19}/></div><div className="stat-label">{t.history}</div><strong className="stat-value">{jobs.filter(j=>j.status==='submitted').length}</strong><div className="stat-detail">{t.submitted}</div></article><article className="stat"><div className="stat-icon orange"><Wifi size={19}/></div><div className="stat-label">{t.printerStatus}</div><strong className="stat-value">{printer?.cups_running ? t.ready : '—'}</strong><div className="stat-detail">CUPS</div></article></section>
          <section className="upload"><div className="upload-art"><div className="cloud"><Upload size={31}/></div></div><h2>{t.print}</h2><p>{t.subtitle}</p><button className="primary" disabled={busy} onClick={()=>input.current?.click()}>{busy?<LoaderCircle className="spin" size={17}/>:<Upload size={17}/>} {busy?t.uploading:t.choose}</button><input ref={input} type="file" multiple accept={accept} hidden onChange={e=>{upload(e.target.files);e.target.value='';}}/><div className="upload-hint">{t.supported}</div></section>
          <section className="panel"><div className="panel-head"><div><h2>{t.recent}</h2><p>{t.settingsText}</p></div><button className="see-all" onClick={()=>setPage('queue')}>{t.queue} →</button></div>{jobList(jobs.slice(0,5))}</section>
        </>}
        {page === 'print' && <section className="panel"><div className="panel-head"><div><h2>{t.print}</h2><p>{lang==='th'?'ไฟล์ที่อัปโหลดจะถูกบันทึกไว้ในรายการนี้ และกลับมาพิมพ์ซ้ำได้ภายหลัง':'Uploaded files stay in this list so you can print them again later.'}</p></div></div><section className="upload"><div className="upload-art"><div className="cloud"><Upload size={31}/></div></div><h2>{t.choose}</h2><p>{t.subtitle}</p><button className="primary" disabled={busy} onClick={()=>input.current?.click()}>{busy?<LoaderCircle className="spin" size={17}/>:<Upload size={17}/>} {busy?t.uploading:t.choose}</button><input type="file" multiple accept={accept} hidden ref={input} onChange={e=>{upload(e.target.files);e.target.value='';}}/><div className="upload-hint">{t.supported}</div></section>{jobList(jobs)}</section>}
        {page === 'queue' && <section className="panel"><div className="panel-head"><div><h2>{t.queue}</h2><p>{t.uploaded}</p></div><button className="outline" style={{width:'auto'}} onClick={refresh}>{t.refresh}</button></div>{jobList(shownJobs)}</section>}
        {page === 'history' && <section className="panel"><div className="panel-head"><div><h2>{t.history}</h2><p>{t.submitted}</p></div><button className="outline" style={{width:'auto'}} onClick={refresh}>{t.refresh}</button></div>{jobList(shownJobs)}</section>}
        {page === 'printers' && <section className="panel"><div className="panel-head"><div><h2>{t.setup}</h2><p>{t.printerStatus}</p></div><button className="outline" style={{width:'auto'}} onClick={refresh}><Activity size={15}/>{t.refresh}</button></div><div className="job-list">{(printer?.printers || []).map(p=><article className="job" key={p.name}><div className="file-type doc"><Printer size={20}/></div><div className="job-name"><b>{p.name}</b><small>{p.raw}</small></div><span className="uploaded">{p.status === 'ready' ? t.ready : t.printerStatus}</span></article>)}{!configured&&<p>{lang==='th'?'ยังไม่พบเครื่องพิมพ์ที่ตั้งค่าไว้':'No configured printers found'}</p>}</div></section>}
        {page === 'settings' && <section className="panel"><h2>{t.settings}</h2><p>{t.settingsText}</p><p>{lang==='th'?'ภาษา':'Language'}: <button className="outline" style={{width:'auto'}} onClick={()=>setLang(lang==='th'?'en':'th')}>{lang==='th'?'เปลี่ยนเป็น English':'Switch to Thai'}</button></p></section>}
        {page === 'help' && <section className="panel"><h2>{t.help}</h2><p>{t.helpText}</p><ol><li>{lang==='th'?'ไปที่พิมพ์เอกสาร':'Open Print files'}</li><li>{lang==='th'?'เลือก PNG, JPG, PDF หรือไฟล์ Office':'Choose PNG, JPG, PDF or an Office document'}</li><li>{lang==='th'?'กดพิมพ์ข้างชื่อไฟล์':'Press Print next to the file name'}</li></ol></section>}
        {selectedJob && <div className="backdrop" role="presentation" onClick={e=>{if(e.target===e.currentTarget)setSelectedJob(null);}}><section className="modal print-options" role="dialog" aria-modal="true" aria-labelledby="print-dialog-title"><div className="modal-head"><div><h2 id="print-dialog-title">{lang==='th'?'ตั้งค่าการพิมพ์':'Print options'}</h2><p>{selectedJob.name}</p></div><button className="icon-btn" onClick={()=>setSelectedJob(null)} aria-label="Close"><X size={17}/></button></div><div className="preview-pane">{selectedJob.extension?.toLowerCase() === '.svg' ? <img src={selectedJob.preview_url} alt={selectedJob.name} /> : <iframe title={lang==='th'?'ตัวอย่างก่อนพิมพ์':'Print preview'} src={selectedJob.preview_url} />}</div><div className="print-fields"><label>{lang==='th'?'หน้าที่ต้องการพิมพ์':'Pages to print'}<select value={printOptions.pages==='all'?'all':'custom'} onChange={e=>setPrintOptions(o=>({...o,pages:e.target.value==='all'?'all':''}))}><option value="all">{lang==='th'?'ทุกหน้า':'All pages'}</option><option value="custom">{lang==='th'?'ระบุหน้าเอง':'Custom range'}</option></select></label>{printOptions.pages!=='all'&&<label>{lang==='th'?'ระบุหน้า':'Page range'}<input autoFocus value={printOptions.pages} onChange={e=>setPrintOptions(o=>({...o,pages:e.target.value}))} placeholder="1-3, 5, 8-10"/><small>{lang==='th'?'ตัวอย่าง: 1-3, 5, 8-10':'Example: 1-3, 5, 8-10'}</small></label>}<label>{lang==='th'?'จำนวนสำเนา':'Copies'}<input type="number" min="1" max="99" value={printOptions.copies} onChange={e=>setPrintOptions(o=>({...o,copies:e.target.value}))}/></label><label>{lang==='th'?'ขนาดกระดาษ':'Paper size'}<select value={printOptions.paper_size} onChange={e=>setPrintOptions(o=>({...o,paper_size:e.target.value}))}><option value="A4">A4</option><option value="A5">A5</option><option value="LETTER">Letter</option><option value="LEGAL">Legal</option></select></label><label>{lang==='th'?'โหมดสี':'Color mode'}<select value={printOptions.color_mode} onChange={e=>setPrintOptions(o=>({...o,color_mode:e.target.value}))}><option value="color">{lang==='th'?'สี':'Color'}</option><option value="monochrome">{lang==='th'?'ขาวดำ':'Monochrome'}</option></select></label><label>{lang==='th'?'หน้าต่อแผ่น':'Pages per sheet'}<select value={printOptions.pages_per_sheet} onChange={e=>setPrintOptions(o=>({...o,pages_per_sheet:Number(e.target.value)}))}><option value={1}>1 {lang==='th'?'หน้าต่อแผ่น':'page per sheet'}</option><option value={2}>2 {lang==='th'?'หน้าต่อแผ่น':'pages per sheet'}</option><option value={4}>4 {lang==='th'?'หน้าต่อแผ่น':'pages per sheet'}</option><option value={6}>6 {lang==='th'?'หน้าต่อแผ่น':'pages per sheet'}</option><option value={9}>9 {lang==='th'?'หน้าต่อแผ่น':'pages per sheet'}</option><option value={16}>16 {lang==='th'?'หน้าต่อแผ่น':'pages per sheet'}</option></select><small>{lang==='th'?'ประหยัดกระดาษ: จัดหลายหน้าเอกสารลงบนกระดาษ 1 แผ่น':'Save paper by placing multiple document pages on one sheet'}</small></label><label>{lang==='th'?'แนวกระดาษ':'Orientation'}<select value={printOptions.orientation} onChange={e=>setPrintOptions(o=>({...o,orientation:e.target.value}))}><option value="portrait">{lang==='th'?'แนวตั้ง':'Portrait'}</option><option value="landscape">{lang==='th'?'แนวนอน':'Landscape'}</option></select></label><label>{lang==='th'?'การปรับขนาด':'Scale'}<select value={printOptions.scaling} onChange={e=>setPrintOptions(o=>({...o,scaling:e.target.value}))}><option value="fit">{lang==='th'?'ย่อ/ขยายให้พอดีกระดาษ':'Fit to printable area'}</option><option value="actual">{lang==='th'?'ขนาดจริง':'Actual size'}</option></select></label><label>{lang==='th'?'กรอบรอบหน้า':'Page border'}<select value={printOptions.page_border} onChange={e=>setPrintOptions(o=>({...o,page_border:e.target.value}))}><option value="none">{lang==='th'?'ไม่มีกรอบ':'None'}</option><option value="single">{lang==='th'?'เส้นเดียว':'Single line'}</option><option value="double">{lang==='th'?'สองเส้น':'Double line'}</option></select></label></div><div className="modal-foot"><button className="outline" onClick={()=>setSelectedJob(null)}>{lang==='th'?'ยกเลิก':'Cancel'}</button><button className="primary" disabled={printing===selectedJob.id || !Number.isInteger(Number(printOptions.copies)) || Number(printOptions.copies)<1 || Number(printOptions.copies)>99 || (printOptions.pages!=='all'&&!validPageRange(printOptions.pages))} onClick={()=>printJob(selectedJob,{...printOptions,copies:Number(printOptions.copies)})}>{printing===selectedJob.id?<LoaderCircle className="spin" size={16}/>:<Printer size={16}/>} {lang==='th'?'ส่งพิมพ์':'Print'}</button></div></section></div>}
        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
        <footer><span>© 2026 PrintHub</span><span>{t.subtitle}</span><button onClick={()=>setLang(lang==='th'?'en':'th')}><Languages size={14}/>{lang==='th'?'English':'ภาษาไทย'}</button></footer>
      </div>
    </main>
  </div>;
}
