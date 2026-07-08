import { useQueue } from '@/hooks/useQueue';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ChevronRight, Shuffle, ArrowRight, Star } from 'lucide-react';
import type { PresenceWithProfile, Channel } from '@/types/types';
import { getUserRoles } from '@/services/adminService';
import { useEffect, useState } from 'react';
import type { Role } from '@/types/types';

// =============================================
// Role badge for a user
// =============================================
function UserRolesBadges({ userId }: { userId: string }) {
  const [roles, setRoles] = useState<Role[]>([]);
  useEffect(() => {
    getUserRoles(userId).then(ur => setRoles(ur.map(u => u.role!).filter(Boolean)));
  }, [userId]);
  if (!roles.length) return null;
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {roles.slice(0, 2).map(r => (
        <span key={r.id} className="role-badge" style={{ color: r.color, borderColor: r.color + '55' }}>
          {r.name}
        </span>
      ))}
    </span>
  );
}

// =============================================
// Single user row inside a channel
// =============================================
interface UserRowProps {
  presence: PresenceWithProfile;
  isPointed: boolean;
  isMe: boolean;
  channels: Channel[];
  onSwitchChannel: (channelId: string) => void;
}

function UserRow({ presence, isPointed, isMe, channels, onSwitchChannel }: UserRowProps) {
  const displayName = presence.profile?.nickname || presence.profile?.ic_name || presence.profile?.username || '?';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm group transition-colors
      ${isMe ? 'bg-primary/5' : 'hover:bg-muted/50'}
    `}>
      {/* Online dot */}
      <span className="online-dot-static" />

      {/* Pointer */}
      <span className={`w-4 text-center text-sm transition-opacity ${isPointed ? 'opacity-100' : 'opacity-0'}`}>
        👉
      </span>

      {/* OP star */}
      {presence.is_op && (
        <Star className="w-3.5 h-3.5 text-warning fill-warning shrink-0" />
      )}

      {/* Name */}
      <span className={`flex-1 min-w-0 text-sm ${isMe ? 'text-primary font-semibold' : 'text-foreground'} truncate`}>
        {displayName}
        {isMe && <span className="ml-1 text-xs text-muted-foreground">(คุณ)</span>}
      </span>

      {/* Role badges */}
      <UserRolesBadges userId={presence.user_id} />

      {/* IC name */}
      {presence.profile?.ic_name && presence.profile.ic_name !== displayName && (
        <span className="text-xs text-muted-foreground hidden md:block truncate max-w-24">
          [{presence.profile.ic_name}]
        </span>
      )}

      {/* Switch channel menu — only for self */}
      {isMe && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded border border-transparent hover:border-border transition-colors shrink-0">
              เมนู <ChevronRight className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {channels.map(ch => (
              <DropdownMenuItem
                key={ch.id}
                onClick={() => onSwitchChannel(ch.id)}
                disabled={ch.id === presence.channel_id}
                className={ch.id === presence.channel_id ? 'opacity-50' : ''}
              >
                {ch.id === presence.channel_id ? '✓ ' : ''}{ch.display_name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// =============================================
// Channel section
// =============================================
interface ChannelSectionProps {
  channel: Channel;
  presences: PresenceWithProfile[];
  pointedUserId: string | null;
  myUserId: string;
  channels: Channel[];
  onSwitchChannel: (channelId: string) => void;
}

function ChannelSection({ channel, presences, pointedUserId, myUserId, channels, onSwitchChannel }: ChannelSectionProps) {
  return (
    <div className="mb-1">
      {/* Channel header */}
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {channel.display_name}
        </span>
        <span className="text-xs text-muted-foreground">— {presences.length}</span>
        {!channel.track_time && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 border-muted-foreground/30 text-muted-foreground">
            ไม่นับเวลา
          </Badge>
        )}
      </div>
      {/* Users */}
      <div>
        {presences.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-1 italic">ว่างอยู่</p>
        ) : (
          presences.map(p => (
            <UserRow
              key={p.id}
              presence={p}
              isPointed={pointedUserId === p.user_id}
              isMe={p.user_id === myUserId}
              channels={channels}
              onSwitchChannel={onSwitchChannel}
            />
          ))
        )}
      </div>
      <div className="channel-divider mt-2" />
    </div>
  );
}

// =============================================
// OP Box
// =============================================
interface OPBoxProps {
  opList: PresenceWithProfile[];
  myPresence: PresenceWithProfile | null | undefined;
  onToggleOP: () => void;
  onRandom: () => void;
  onNext: () => void;
}

function OPBox({ opList, myPresence, onToggleOP, onRandom, onNext }: OPBoxProps) {
  const isOP = myPresence?.is_op ?? false;

  return (
    <div className="rounded-sm border border-warning/30 bg-warning/5 mb-4">
      <div className="flex items-center justify-between px-3 py-2 border-b border-warning/20">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-warning fill-warning" />
          <span className="text-sm font-bold text-warning tracking-wider">คนรับ OP</span>
          <span className="text-xs text-muted-foreground">({opList.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRandom}
            className="h-7 text-xs border-border"
            title="สุ่มผู้ทำหน้าที่ OP"
          >
            <Shuffle className="w-3 h-3 mr-1" /> สุ่ม
          </Button>
          <Button
            size="sm"
            onClick={onNext}
            disabled={!isOP}
            className="h-7 text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
            title={isOP ? 'เลื่อนคิวถัดไป' : 'เฉพาะ OP เท่านั้น'}
          >
            <ArrowRight className="w-3 h-3 mr-1" /> ถัดไป
          </Button>
        </div>
      </div>
      <div className="px-3 py-2 min-h-10">
        {opList.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">ยังไม่มีคนรับ OP</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {opList.map(p => (
              <div key={p.id} className="flex items-center gap-1.5">
                <span className="online-dot-static" />
                <span className="text-sm font-semibold text-warning">
                  {p.profile?.nickname || p.profile?.ic_name || p.profile?.username}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* My OP toggle */}
      <div className="px-3 py-2 border-t border-warning/20 flex justify-end">
        <Button
          variant={isOP ? 'destructive' : 'outline'}
          size="sm"
          onClick={onToggleOP}
          className="h-7 text-xs"
        >
          {isOP ? 'เลิกเป็น OP' : 'ขึ้นเป็น OP'}
        </Button>
      </div>
    </div>
  );
}

// =============================================
// Main Queue Page
// =============================================
export default function QueuePage() {
  const { user } = useAuth();
  const {
    presenceByChannel, channels, pointer, myPresence,
    opList, loading, handleSwitchChannel, handleToggleOP,
    handleNextPointer, handleRandomOP,
  } = useQueue();

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  const totalOnline = Object.values(presenceByChannel).flat().length;

  return (
    <div className="p-3 md:p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">ห้องปฏิบัติการ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="inline-flex items-center gap-1">
              <span className="online-dot-static" />
              ออนไลน์ {totalOnline} คน
            </span>
          </p>
        </div>
      </div>

      {/* OP Box */}
      <OPBox
        opList={opList}
        myPresence={myPresence}
        onToggleOP={handleToggleOP}
        onRandom={handleRandomOP}
        onNext={handleNextPointer}
      />

      {/* Channel list */}
      <div className="rounded-sm border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">รายชื่อออนไลน์</p>
        </div>
        <div className="p-2">
          {channels.map(ch => (
            <ChannelSection
              key={ch.id}
              channel={ch}
              presences={presenceByChannel[ch.id] ?? []}
              pointedUserId={pointer?.pointed_user_id ?? null}
              myUserId={user?.id ?? ''}
              channels={channels}
              onSwitchChannel={(cid) => {
                handleSwitchChannel(cid);
                toast.success(`ย้ายไป ${channels.find(c => c.id === cid)?.display_name || ''}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
