import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Lock, User, Plus, Trash2, Search, Sliders, Users, Shield, ScrollText, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Query Logs State（查询记录：日期筛选 / 分页 / 统计 / 导出）
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logHitCount, setLogHitCount] = useState(0);
  const [logMissCount, setLogMissCount] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const LOG_PAGE_SIZE = 20;

  useEffect(() => {
    if (token) {
        fetchLicenses();
        fetchAdmins();
    }
  }, [token]);

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

  const buildLogParams = (page = logPage) => {
      const params = { page, page_size: LOG_PAGE_SIZE };
      if (logStartDate) params.start_date = logStartDate;
      if (logEndDate) params.end_date = logEndDate;
      return params;
  };

  const fetchLogs = async (page = logPage) => {
      setLogsLoading(true);
      try {
          const res = await axios.get('/api/license/query-logs', { params: buildLogParams(page) });
          setLogs(res.data.list || []);
          setLogTotal(res.data.total || 0);
          setLogHitCount(res.data.hit_count || 0);
          setLogMissCount(res.data.miss_count || 0);
          setLogPage(res.data.page || 1);
      } catch (err) {
          toast.error('查询记录加载失败');
      } finally {
          setLogsLoading(false);
      }
  };

  const handleLogSearch = (e) => {
      e.preventDefault();
      if (logStartDate && logEndDate && logStartDate > logEndDate) {
          toast.error('开始日期不能晚于结束日期');
          return;
      }
      fetchLogs(1);
  };

  const handleLogReset = () => {
      setLogStartDate('');
      setLogEndDate('');
      setLogPage(1);
      // 下一帧再请求，确保 state 已清空
      setTimeout(() => fetchLogs(1), 0);
  };

  const handleExportLogs = () => {
      if (logStartDate && logEndDate && logStartDate > logEndDate) {
          toast.error('开始日期不能晚于结束日期');
          return;
      }
      const qs = new URLSearchParams(buildLogParams(1));
      qs.delete('page');
      qs.delete('page_size');
      // 直接走浏览器下载（该接口返回 CSV 附件）
      window.open(`/api/license/export-logs?${qs.toString()}`, '_blank');
  };

  const switchTab = (tab) => {
      setActiveTab(tab);
      if (tab === 'logs') fetchLogs(1);
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
           {activeTab !== 'logs' && (
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
           )}
           <button onClick={() => {localStorage.removeItem('auth_token'); setToken(null);}} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition border border-white/5 hover:border-red-500/30">
             退出登录
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Add Form / Log Filters */}
        <div className="lg:col-span-1">
          {activeTab === 'logs' ? (
            <div className="glass-card p-6 sticky top-6 space-y-5">
              <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <div className="p-1.5 bg-sky-500/20 rounded-lg text-sky-400">
                  <ScrollText className="w-4 h-4"/>
                </div>
                按日期筛选
              </h3>
              <form onSubmit={handleLogSearch} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-white/40">开始日期</label>
                  <input
                    type="date"
                    value={logStartDate}
                    max={logEndDate || undefined}
                    onChange={e => setLogStartDate(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">结束日期</label>
                  <input
                    type="date"
                    value={logEndDate}
                    min={logStartDate || undefined}
                    onChange={e => setLogEndDate(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="tech-button flex-1 flex justify-center items-center gap-2 !py-2 !text-sm">
                    <Search size={14}/> 查询
                  </button>
                  <button
                    type="button"
                    onClick={handleLogReset}
                    className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 border border-white/5 text-sm"
                  >
                    重置
                  </button>
                </div>
              </form>

              <button
                onClick={handleExportLogs}
                className="w-full flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition text-sm font-medium"
              >
                <Download size={15}/> 导出当前筛选 CSV
              </button>

              <div className="border-t border-white/5 pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">总查询次数</span>
                  <span className="text-white font-mono font-semibold">{logTotal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">命中</span>
                  <span className="text-emerald-400 font-mono font-semibold">{logHitCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">未命中</span>
                  <span className="text-red-400 font-mono font-semibold">{logMissCount}</span>
                </div>
              </div>
            </div>
          ) : (
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
          )}
        </div>

        {/* Main: Details List */}
        <div className="lg:col-span-3">
           <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
             <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 gap-4 flex-wrap">
                 <h3 className="font-bold flex items-center gap-2">
                    {activeTab === 'license' && <Sliders size={18} className="text-sky-400"/>}
                    {activeTab === 'admin' && <Shield size={18} className="text-sky-400"/>}
                    {activeTab === 'logs' && <ScrollText size={18} className="text-sky-400"/>}
                    {activeTab === 'license' ? '授权列表' : activeTab === 'admin' ? '管理员列表' : '查询记录'}
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60">
                        {activeTab === 'license' ? filteredLicenses.length : activeTab === 'admin' ? admins.length : logTotal}
                    </span>
                 </h3>
                 <div className="flex space-x-2">
                    <button
                        onClick={() => switchTab('license')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'license' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Users className="inline-block w-4 h-4 mr-2" /> 授权管理
                    </button>
                    <button
                        onClick={() => switchTab('admin')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Shield className="inline-block w-4 h-4 mr-2" /> 管理员管理
                    </button>
                    <button
                        onClick={() => switchTab('logs')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'logs' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <ScrollText className="inline-block w-4 h-4 mr-2" /> 查询记录
                    </button>
                 </div>
             </div>
                          <div className="overflow-x-auto flex-1">
                {activeTab === 'logs' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      <th className="p-4">查询时间</th>
                      <th className="p-4">授权QQ</th>
                      <th className="p-4">授权主人</th>
                      <th className="p-4">所属产品</th>
                      <th className="p-4">是否命中</th>
                      <th className="p-4">访问IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {logsLoading ? (
                       <tr><td colSpan="6" className="p-12 text-center text-white/30">加载中...</td></tr>
                    ) : logs.length === 0 ? (
                       <tr><td colSpan="6" className="p-12 text-center text-white/30">该日期范围内暂无查询记录</td></tr>
                    ) : (
                      logs.map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition">
                          <td className="p-4 text-white/70 font-mono text-xs whitespace-nowrap">{item.created_at}</td>
                          <td className="p-4 text-sky-300 font-mono text-sm">{item.queried_qq}</td>
                          <td className="p-4 text-sm text-white/80">{item.queried_owner || '-'}</td>
                          <td className="p-4 text-sm">
                            {item.product_name
                              ? item.product_name
                              : <span className="text-white/30">—</span>}
                          </td>
                          <td className="p-4">
                            {item.is_hit === 1 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">命中</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">未命中</span>
                            )}
                          </td>
                          <td className="p-4 text-white/50 font-mono text-xs">{item.ip || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                ) : (
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
                )}
              </div>

              {/* Footer：日志页显示分页，其它页保持原样 */}
              {activeTab === 'logs' ? (
                <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                  <span>
                    共 {logTotal} 条 · 第 {logPage} / {Math.max(1, Math.ceil(logTotal / LOG_PAGE_SIZE))} 页
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={logPage <= 1 || logsLoading}
                      onClick={() => fetchLogs(logPage - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft size={14}/> 上一页
                    </button>
                    <button
                      disabled={logPage >= Math.ceil(logTotal / LOG_PAGE_SIZE) || logsLoading}
                      onClick={() => fetchLogs(logPage + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      下一页 <ChevronRight size={14}/>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-white/5 text-xs text-white/30 text-center">
                  End of List
                </div>
              )}
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
