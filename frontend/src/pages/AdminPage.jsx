import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Lock, User, Plus, Trash2, Search, Sliders, Users, Shield, History, Download, CalendarDays, CheckCircle2, XCircle } from 'lucide-react';
import Modal from '../components/Modal';

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Dashboard State
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newLicense, setNewLicense] = useState({
    qq: '', owner_name: '', product_name: '', upline: '官方', expiration_date: ''
  });

  // Modal State
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState('license'); // 'license' or 'admin'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Admin Management State
  const [activeTab, setActiveTab] = useState('license'); // 'license' | 'admin' | 'logs'
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });

  // Query Logs State
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [logs, setLogs] = useState([]);
  const [logStats, setLogStats] = useState({ total: 0, hit: 0, miss: 0 });
  const [logStart, setLogStart] = useState('');
  const [logEnd, setLogEnd] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (token) {
        fetchLicenses();
        fetchAdmins();
    }
  }, [token]);

  useEffect(() => {
    if (token && activeTab === 'logs') {
      fetchLogs();
    }
  }, [token, activeTab]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredLicenses(licenses);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredLicenses(licenses.filter(l => 
        l.qq.includes(lower) || 
        l.owner_name.toLowerCase().includes(lower) ||
        l.product_name.toLowerCase().includes(lower)
      ));
    }
  }, [searchTerm, licenses]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('auth_token', res.data.token);
      setToken(res.data.token);
      toast.success('欢迎回来，管理员');
    } catch (err) {
      toast.error('登录失败: 用户名或密码错误');
    }
  };

  const fetchLicenses = async () => {
    try {
      const res = await axios.get('/api/license/list');
      setLicenses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'license') {
          await axios.post('/api/license/create', newLicense);
          toast.success('授权添加成功');
          setNewLicense({ qq: '', owner_name: '', product_name: '', upline: '官方', expiration_date: '' });
          fetchLicenses();
      } else {
          await axios.post('/api/auth/create', newAdmin);
          toast.success('管理员添加成功');
          setNewAdmin({ username: '', password: '' });
          fetchAdmins();
      }
    } catch (err) {
      toast.error('添加失败：' + (err.response?.data?.message || '网络错误'));
    }
  };

  const fetchAdmins = async () => {
      try {
          const res = await axios.get('/api/auth/list');
          setAdmins(res.data);
      } catch (err) {
          console.error(err);
      }
  };

  const buildLogQuery = (start = logStart, end = logEnd) => {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const qs = params.toString();
      return qs ? `?${qs}` : '';
  };

  const fetchLogs = async (override = {}) => {
      const start = Object.prototype.hasOwnProperty.call(override, 'start') ? override.start : logStart;
      const end = Object.prototype.hasOwnProperty.call(override, 'end') ? override.end : logEnd;
      setLogsLoading(true);
      try {
          const res = await axios.get(`/api/license/query-logs${buildLogQuery(start, end)}`);
          setLogs(res.data.logs || []);
          setLogStats(res.data.stats || { total: 0, hit: 0, miss: 0 });
      } catch (err) {
          console.error(err);
          toast.error('查询记录加载失败');
      } finally {
          setLogsLoading(false);
      }
  };

  const handleLogFilter = (e) => {
      e.preventDefault();
      fetchLogs();
  };

  const handleLogReset = () => {
      setLogStart('');
      setLogEnd('');
      fetchLogs({ start: '', end: '' });
  };

  const handleQuickDay = (days) => {
      const end = todayStr();
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      const startStr = start.toISOString().slice(0, 10);
      setLogStart(startStr);
      setLogEnd(end);
      fetchLogs({ start: startStr, end });
  };

  const handleExportLogs = () => {
      // 直接以当前筛选条件触发下载，导出列顺序由后端按客服核对习惯固定
      window.open(`/api/license/query-logs/export${buildLogQuery()}`, '_blank');
  };

  const formatLogTime = (t) => {
      if (!t) return '-';
      const d = new Date(t.replace(' ', 'T'));
      if (isNaN(d.getTime())) return t;
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const handleCreateAdmin = async (e) => {
      // Merged into handleCreate logic above based on activeTab
  };

  const confirmDelete = (id, type = 'license') => {
    setDeleteId(id);
    setDeleteType(type);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      if (deleteType === 'license') {
          await axios.post('/api/license/delete', { id: deleteId });
          toast.success('已删除该授权');
          fetchLicenses();
      } else {
          await axios.post('/api/auth/delete', { id: deleteId });
          toast.success('已删除该管理员');
          fetchAdmins();
      }
    } catch(err) {
      toast.error('删除失败');
    }
  };

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md glass-card p-10 animate-fade-in-up">
           <div className="text-center mb-8">
             <div className="w-16 h-16 bg-sky-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-sky-400">
               <Lock size={32} />
             </div>
             <h2 className="text-2xl font-bold text-white">管理员登录</h2>
             <p className="text-white/40 mt-2 text-sm">请输入您的管理凭证以继续</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-5">
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">账号</label>
               <div className="relative group">
                 <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="glass-input w-full pl-10 h-11" placeholder="Administrator" />
                 <User className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">密码</label>
               <div className="relative group">
                 <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="glass-input w-full pl-10 h-11" placeholder="••••••••" />
                 <Lock className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <button type="submit" className="tech-button w-full mt-2 !py-3 !text-sm tracking-widest">登录</button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-sky-300">
            授权管理中心
          </h1>
          <p className="text-white/40 mt-1">System Administration Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="relative">
             <input 
                type="text" 
                placeholder="搜索QQ、主人或产品..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="glass-input pl-10 pr-4 py-2 w-64 text-sm"
             />
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
           </div>
           <button onClick={() => {localStorage.removeItem('auth_token'); setToken(null);}} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition border border-white/5 hover:border-red-500/30">
             退出登录
           </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-8 ${activeTab === 'logs' ? '' : 'lg:grid-cols-4'}`}>
        {/* Sidebar: Add Form */}
        {activeTab !== 'logs' && (
        <div className="lg:col-span-1">
          <div className="glass-card p-6 sticky top-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <div className="p-1.5 bg-sky-500/20 rounded-lg text-sky-400">
                  <Plus className="w-4 h-4"/>
                </div>
                {activeTab === 'license' ? '新增授权' : '新增管理员'}
              </h3>
              <form onSubmit={handleCreate} className="space-y-4">
                 {activeTab === 'license' ? (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权QQ</label>
                            <input required className="glass-input w-full" placeholder="输入QQ号" value={newLicense.qq} onChange={e=>setNewLicense({...newLicense, qq:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权主人</label>
                            <input required className="glass-input w-full" placeholder="输入名称" value={newLicense.owner_name} onChange={e=>setNewLicense({...newLicense, owner_name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">所属产品</label>
                            <input required className="glass-input w-full" placeholder="例如：授权平台" value={newLicense.product_name} onChange={e=>setNewLicense({...newLicense, product_name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权上级</label>
                            <input required className="glass-input w-full" placeholder="默认：官方" value={newLicense.upline} onChange={e=>setNewLicense({...newLicense, upline:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">过期时间</label>
                            <input required type="datetime-local" className="glass-input w-full" value={newLicense.expiration_date} onChange={e=>setNewLicense({...newLicense, expiration_date:e.target.value})} />
                        </div>
                     </>
                 ) : (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">用户名</label>
                            <input required className="glass-input w-full" placeholder="输入新管理员账号" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">密码</label>
                            <input required type="text" className="glass-input w-full" placeholder="设置初始密码" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password:e.target.value})} />
                        </div>
                     </>
                 )}
                 <div className="pt-2">
                    <button type="submit" className="tech-button w-full flex justify-center items-center gap-2">
                      <Plus size={16} /> {activeTab === 'license' ? '立即授权' : '添加管理员'}
                    </button>
                 </div>
              </form>
          </div>
        </div>
        )}

        {/* Main: Details List */}
        <div className={activeTab === 'logs' ? '' : 'lg:col-span-3'}>
           <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
             <div className="p-6 border-b border-white/5 bg-white/5">
                 <div className="flex flex-wrap justify-between items-center gap-4">
                   <h3 className="font-bold flex items-center gap-2">
                      {activeTab === 'license' && <Sliders size={18} className="text-sky-400"/>}
                      {activeTab === 'admin' && <Shield size={18} className="text-sky-400"/>}
                      {activeTab === 'logs' && <History size={18} className="text-sky-400"/>}
                      {activeTab === 'license' ? '授权列表' : activeTab === 'admin' ? '管理员列表' : '前台查询记录'}
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60">
                          {activeTab === 'license' ? filteredLicenses.length : activeTab === 'admin' ? admins.length : logStats.total}
                      </span>
                   </h3>
                   <div className="flex flex-wrap gap-2">
                      <button
                          onClick={() => setActiveTab('license')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'license' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                      >
                          <Users className="inline-block w-4 h-4 mr-2" /> 授权管理
                      </button>
                      <button
                          onClick={() => setActiveTab('logs')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'logs' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                      >
                          <History className="inline-block w-4 h-4 mr-2" /> 查询记录
                      </button>
                      <button
                          onClick={() => setActiveTab('admin')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                      >
                          <Shield className="inline-block w-4 h-4 mr-2" /> 管理员管理
                      </button>
                   </div>
                 </div>

                 {activeTab === 'logs' && (
                   <div className="mt-4 flex flex-wrap items-end gap-3">
                      <form onSubmit={handleLogFilter} className="flex flex-wrap items-end gap-3">
                         <div>
                            <label className="block text-[11px] text-white/40 mb-1 flex items-center gap-1"><CalendarDays size={12}/>开始日期</label>
                            <input type="date" value={logStart} onChange={e => setLogStart(e.target.value)} className="glass-input h-9 px-3 text-sm" />
                         </div>
                         <div>
                            <label className="block text-[11px] text-white/40 mb-1 flex items-center gap-1"><CalendarDays size={12}/>结束日期</label>
                            <input type="date" value={logEnd} onChange={e => setLogEnd(e.target.value)} className="glass-input h-9 px-3 text-sm" />
                         </div>
                         <button type="submit" className="h-9 px-4 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-sm font-medium transition">
                            筛选
                         </button>
                         <button type="button" onClick={handleLogReset} className="h-9 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 border border-white/5 text-sm transition">
                            重置
                         </button>
                      </form>
                      <div className="flex gap-2">
                         <button type="button" onClick={() => handleQuickDay(1)} className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 border border-white/5 text-xs transition">今天</button>
                         <button type="button" onClick={() => handleQuickDay(7)} className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 border border-white/5 text-xs transition">近7天</button>
                         <button type="button" onClick={() => handleQuickDay(30)} className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 border border-white/5 text-xs transition">近30天</button>
                      </div>
                      <button
                         onClick={handleExportLogs}
                         className="h-9 px-4 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-sm font-medium transition flex items-center gap-2 ml-auto"
                      >
                         <Download size={15}/> 导出 CSV
                      </button>
                   </div>
                 )}
             </div>

             {activeTab === 'logs' && (
               <div className="grid grid-cols-3 gap-4 p-6 pb-0">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                     <div className="text-xs text-white/40 mb-1">总查询次数</div>
                     <div className="text-2xl font-bold text-white">{logStats.total}</div>
                  </div>
                  <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                     <div className="text-xs text-green-400/70 mb-1 flex items-center gap-1"><CheckCircle2 size={12}/>命中</div>
                     <div className="text-2xl font-bold text-green-400">{logStats.hit}</div>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                     <div className="text-xs text-red-400/70 mb-1 flex items-center gap-1"><XCircle size={12}/>未命中</div>
                     <div className="text-2xl font-bold text-red-400">{logStats.miss}</div>
                  </div>
               </div>
             )}

             {activeTab === 'logs' ? (
                <div className="overflow-x-auto flex-1 p-6">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                         <th className="p-3 rounded-l-lg">查询时间</th>
                         <th className="p-3">授权QQ</th>
                         <th className="p-3">授权主人</th>
                         <th className="p-3">所属产品</th>
                         <th className="p-3">是否命中</th>
                         <th className="p-3 rounded-r-lg">访问IP</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {logsLoading ? (
                          <tr><td colSpan="6" className="p-12 text-center text-white/30">加载中...</td></tr>
                       ) : logs.length === 0 ? (
                          <tr><td colSpan="6" className="p-12 text-center text-white/30">暂无查询记录</td></tr>
                       ) : logs.map(item => (
                          <tr key={item.id} className="hover:bg-white/[0.02] transition">
                             <td className="p-3 font-mono text-xs text-white/70 whitespace-nowrap">{formatLogTime(item.queried_at)}</td>
                             <td className="p-3 text-sky-300 font-mono text-sm">{item.qq}</td>
                             <td className="p-3 text-sm">{item.owner_name || '-'}</td>
                             <td className="p-3 text-sm">{item.product_name || '-'}</td>
                             <td className="p-3">
                                {item.is_hit ? (
                                   <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                      <CheckCircle2 size={12}/>命中
                                   </span>
                                ) : (
                                   <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                      <XCircle size={12}/>未命中
                                   </span>
                                )}
                             </td>
                             <td className="p-3 font-mono text-xs text-white/50">{item.ip || '-'}</td>
                          </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
             ) : (
             <>
                          <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      {activeTab === 'license' ? (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">授权QQ</th>
                            <th className="p-4">授权信息</th>
                            <th className="p-4">产品/上级</th>
                            <th className="p-4">状态/时间</th>
                          </>
                      ) : (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">管理员账号</th>
                            <th className="p-4">创建时间/状态</th>
                            <th className="p-4"></th>
                            <th className="p-4"></th>
                          </>
                      )}
                      
                      <th className="p-4 text-right">管理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(activeTab === 'license' ? filteredLicenses : admins).length === 0 ? (
                       <tr>
                         <td colSpan="6" className="p-12 text-center text-white/30">
                            暂无数据
                         </td>
                       </tr>
                    ) : (
                      (activeTab === 'license' ? filteredLicenses : admins).map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition group">
                          {activeTab === 'license' ? (
                              <>
                                <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                                        {item.qq.slice(0, 2)}
                                    </div>
                                    <span className="text-sky-300 font-medium font-mono">{item.qq}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-medium">{item.owner_name}</div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm">{item.product_name}</div>
                                    <div className="text-xs text-white/40 mt-0.5">{item.upline}</div>
                                </td>
                                <td className="p-4">
                                    <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 mb-1">
                                    正常
                                    </div>
                                    <div className="text-xs text-white/40 font-mono">
                                    {new Date(item.expiration_date).toLocaleDateString()}
                                    </div>
                                </td>
                              </>
                          ) : (
                              <>
                                <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">
                                            <User size={14} />
                                        </div>
                                        <span className="text-white font-medium">{item.username}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-xs text-white/40">管理员</td>
                                <td className="p-4"></td>
                                <td className="p-4"></td>
                              </>
                          )}
                          
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => confirmDelete(item.id, activeTab)} 
                              className="text-white/20 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
             </>
             )}

              {/* Pagination or Footer (Simple) */}
              <div className="p-4 border-t border-white/5 text-xs text-white/30 text-center">
                {activeTab === 'logs' ? `共 ${logStats.total} 条记录（最多展示最近 2000 条，更多请使用导出）` : 'End of List'}
              </div>
            </div>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        title={deleteType === 'license' ? "确认删除授权" : "确认删除管理员"}
        type="danger"
        content={deleteType === 'license' 
            ? "您确定要删除此授权吗？删除后该用户将无法查询到授权信息，此操作不可恢复。" 
            : "您确定要删除此管理员吗？删除后该账号将无法登录后台。"
        }
      />
    </div>
  );
}
