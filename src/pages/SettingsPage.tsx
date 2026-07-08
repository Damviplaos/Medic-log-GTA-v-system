import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Lock, Shield } from 'lucide-react';
import { updateProfile, changePassword } from '@/services/adminService';

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [nickname, setNickname] = useState('');
  const [icName, setIcName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? '');
      setIcName(profile.ic_name ?? '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    try {
      await updateProfile(profile.id, {
        nickname: nickname.trim() || undefined,
        ic_name: icName.trim() || undefined,
      });
      await refreshProfile();
      toast.success('บันทึกข้อมูลโปรไฟล์สำเร็จ');
    } catch (err) {
      toast.error('บันทึกโปรไฟล์ไม่สำเร็จ');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      toast.error('กรุณากรอกรหัสผ่านใหม่');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(newPassword);
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error('เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">ตั้งค่าบัญชี</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          จัดการข้อมูลส่วนตัวและความปลอดภัย
        </p>
      </div>

      {/* Profile info (read-only) */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> ข้อมูลบัญชี
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-sm bg-muted">
            <div className="w-10 h-10 rounded-sm bg-primary/20 flex items-center justify-center">
              <span className="text-base font-bold text-primary">
                {(profile?.nickname || profile?.username || '?')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{profile?.username}</p>
              <p className="text-xs text-muted-foreground">
                {profile?.system_role === 'super_admin' ? 'Super Admin' :
                  profile?.system_role === 'admin' ? 'Admin' : 'User'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit nickname & IC name */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> ข้อมูลส่วนตัว
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Nickname (ชื่อแสดง)
            </Label>
            <Input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="กรอก Nickname"
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              IC Name (ชื่อในเกม)
            </Label>
            <Input
              value={icName}
              onChange={e => setIcName(e.target.value)}
              placeholder="กรอกชื่อในเกม"
              className="bg-muted border-border"
            />
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="bg-primary text-primary-foreground hover:opacity-90"
            size="sm"
          >
            {savingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </Button>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> เปลี่ยนรหัสผ่าน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              รหัสผ่านใหม่
            </Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              ยืนยันรหัสผ่านใหม่
            </Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="ยืนยันรหัสผ่านใหม่"
              className="bg-muted border-border"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={savingPassword}
            variant="outline"
            size="sm"
          >
            {savingPassword ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
