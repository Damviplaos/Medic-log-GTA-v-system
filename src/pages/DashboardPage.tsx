import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Clock, Star, Calendar, TrendingUp, CheckCircle, ArrowLeft, AlertTriangle, Banknote } from 'lucide-react';
import {
  getWeeklyStats, getDailyStats, getWeekStart,
  getUserRoles, refreshWeeklyStats, getProfile, getRoleCriteria, getWarnings,
} from '@/services/adminService';
import type { WeeklyStats, UserRole, RoleCriteria, Role, Profile } from '@/types/types';
import { toast } from 'sonner';

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtBaht(amount: number): string {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

export default function DashboardPage() {
  const { user, profile: myProfile, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // If ?userId= param present and viewer has permission, show that user's dashboard
  const targetUserId = searchParams.get('userId') || user?.id || '';
  const isViewingOther = !!searchParams.get('userId') && searchParams.get('userId') !== user?.id;
  const canViewOthers = hasPermission('view_member_dashboard');

  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [todayStats, setTodayStats] = useState<{ total_work_seconds: number; total_op_seconds: number } | null>(null);
  const [weekDayStats, setWeekDayStats] = useState<{ date: string; work: number; op: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDateStats, setSelectedDateStats] = useState<{ total_work_seconds: number; total_op_seconds: number } | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [criteria, setCriteria] = useState<RoleCriteria | null>(null);
  const [promotionEligible, setPromotionEligible] = useState(false);
  const [warnings, setWarnings] = useState<{ id: string; reason: string; issued_at: string; is_active: boolean; severity: string; expires_at: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const weekStart = getWeekStart();

  // Redirect if trying to view other without permission
  useEffect(() => {
    if (isViewingOther && !canViewOthers) {
      navigate('/dashboard', { replace: true });
    }
  }, [isViewingOther, canViewOthers, navigate]);

  const loadData = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      await refreshWeeklyStats(targetUserId);
      const [ws, td, ur, tp] = await Promise.all([
        getWeeklyStats(targetUserId, weekStart),
        getDailyStats(targetUserId, new Date().toISOString().split('T')[0]),
        getUserRoles(targetUserId),
        isViewingOther ? getProfile(targetUserId) : Promise.resolve(myProfile),
      ]);
      setWeeklyStats(ws);
      setTodayStats(td);
      setUserRoles(ur);
      setTargetProfile(tp as Profile | null);

      const dates = getWeekDates(weekStart);
      const dayStats = await Promise.all(dates.map(d => getDailyStats(targetUserId, d)));
      setWeekDayStats(dates.map((d, i) => ({
        date: d,
        work: dayStats[i]?.total_work_seconds ?? 0,
        op: dayStats[i]?.total_op_seconds ?? 0,
      })));

      // Load active warnings
      try {
        const w = await getWarnings(targetUserId);
        setWarnings(w.filter(x => x.is_active && (!x.expires_at || new Date(x.expires_at) >= new Date())));
      } catch { setWarnings([]); }

      if (ur.length > 0) {
        const topRole = ur[ur.length - 1]?.role as Role | undefined;
        if (topRole) {
          const c = await getRoleCriteria(topRole.id);
          setCriteria(c);
          if (c && ws) {
            const workH = (ws.total_work_seconds ?? 0) / 3600;
            const opH = (ws.total_op_seconds ?? 0) / 3600;
            const workOk = !c.work_hours_enabled || workH >= (c.min_work_hours_per_week ?? 0);
            const opOk = !c.op_hours_enabled || opH >= (c.min_op_hours_per_week ?? 0);
            setPromotionEligible(workOk && opOk && (c.work_hours_enabled || c.op_hours_enabled));
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, weekStart, isViewingOther, myProfile]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!targetUserId || !selectedDate) return;
    getDailyStats(targetUserId, selectedDate).then(setSelectedDateStats);
  }, [targetUserId, selectedDate]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const dayNames = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const maxDayWork = Math.max(...weekDayStats.map(d => d.work), 3600);
  const displayProfile = isViewingOther ? targetProfile : myProfile;
  const displayName = displayProfile?.nickname || displayProfile?.ic_name || displayProfile?.username || '...';

  // Salary calc
  const weeklyWorkHours = (weeklyStats?.total_work_seconds ?? 0) / 3600;
  const estimatedSalary = criteria?.hourly_salary != null ? criteria.hourly_salary * weeklyWorkHours : null;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isViewingOther && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {isViewingOther ? `Dashboard — ${displayName}` : 'Dashboard ของฉัน'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isViewingOther
                ? `ดูโดย ${myProfile?.username} · สัปดาห์เริ่ม ${weekStart}`
                : displayName
              }
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="text-xs shrink-0">รีเฟรช</Button>
      </div>

      {/* Active warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map(w => (
            <div key={w.id} className="flex items-start gap-2.5 p-3 rounded-sm border border-destructive/40 bg-destructive/10">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-destructive">ใบเตือนที่ยังมีผล</p>
                <p className="text-xs text-destructive/80 mt-0.5">{w.reason}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(w.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promotion alert */}
      {promotionEligible && (
        <div className="flex items-start gap-3 p-3 rounded-sm border border-success/40 bg-success/10">
          <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-success">
            {isViewingOther
              ? `${displayName} ผ่านเกณฑ์เลื่อนยศแล้ว!`
              : 'คุณผ่านเกณฑ์แล้ว กรุณาติดต่อยศสูงกว่าเพื่อสอบเลื่อนขั้น'
            }
          </p>
        </div>
      )}

      {/* Roles */}
      {userRoles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {userRoles.map(ur => ur.role && (
            <span key={ur.id} className="role-badge" style={{ color: ur.role.color, borderColor: ur.role.color + '55' }}>
              {ur.role.name}
            </span>
          ))}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">วันนี้</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtTime(todayStats?.total_work_seconds ?? 0)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมงทำงาน</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">OP วันนี้</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtTime(todayStats?.total_op_seconds ?? 0)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมง OP</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">อาทิตย์นี้</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtTime(weeklyStats?.total_work_seconds ?? 0)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมงรวม</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">OP สัปดาห์</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtTime(weeklyStats?.total_op_seconds ?? 0)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมง OP</p>
          </CardContent>
        </Card>
      </div>

      {/* Salary estimate */}
      {estimatedSalary !== null && (
        <Card className="border-border border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Banknote className="w-8 h-8 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">รายได้ประมาณการ (สัปดาห์นี้)</p>
              <p className="text-xl font-bold text-primary">{fmtBaht(estimatedSalary)} ฿</p>
              <p className="text-[11px] text-muted-foreground">
                {fmtTime(weeklyStats?.total_work_seconds ?? 0)} × {fmtBaht(criteria!.hourly_salary!)} บาท/ชม.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly bar chart */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">สรุปรายวัน (สัปดาห์นี้)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-24">
            {weekDayStats.map((d, i) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col gap-0.5 justify-end" style={{ height: '72px' }}>
                  <div
                    className="w-full rounded-sm bg-primary/70 transition-all"
                    style={{ height: `${(d.work / maxDayWork) * 64}px`, minHeight: d.work > 0 ? '4px' : '0' }}
                    title={`งาน: ${fmtTime(d.work)}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{dayNames[i]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar picker */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" /> ดูรายละเอียดย้อนหลัง
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-muted border border-border rounded-sm px-3 py-1.5 text-sm text-foreground w-full md:w-auto"
          />
          {selectedDateStats && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-sm bg-muted">
                <p className="text-xs text-muted-foreground mb-1">ชั่วโมงทำงาน</p>
                <p className="text-lg font-bold text-foreground">{fmtTime(selectedDateStats.total_work_seconds)}</p>
                {criteria?.hourly_salary != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ≈ {fmtBaht((selectedDateStats.total_work_seconds / 3600) * criteria.hourly_salary)} ฿
                  </p>
                )}
              </div>
              <div className="p-3 rounded-sm bg-muted">
                <p className="text-xs text-muted-foreground mb-1">ชั่วโมง OP</p>
                <p className="text-lg font-bold text-foreground">{fmtTime(selectedDateStats.total_op_seconds)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
