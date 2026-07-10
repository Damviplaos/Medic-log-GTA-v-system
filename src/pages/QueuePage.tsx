import { useQueue } from '@/hooks/useQueue';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ChevronRight, Shuffle, ArrowRight, Star, UserCheck, X } from 'lucide-react';
import type { PresenceWithProfile, Channel } from '@/types/types';
import { getUserRoles } from '@/services/adminService';
import { useEffect, useState, useRef } from 'react';
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
// Pairing picker dialog
// =============================================
interface PairingPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (presence: PresenceWithProfile) => void;
  allPresences: PresenceWithProfile[];
  myUserId: string;
}

function PairingPicker({ open, onClose, onSelect, allPresences, myUserId }: PairingPickerProps) {
  const others = allPresences.filter(p => p.user_id !== myUserId);
  const getName = (p: PresenceWithProfile) =>
    p.profile?.nickname || p.profile?.ic_name || p.profile?.username || '?';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" /> เลือกคู่ที่ต้องการจับคู่
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">ไม่มีผู้ใช้ออนไลน์</p>
          ) : (
            others.map(p => (
              <button
                key={p.user_id}
                onClick={() => { onSelect(p); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-muted/60 transition-colors text-left"
              >
                <span className="online-dot-static shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{getName(p)}</p>
                  {p.channel?.display_name && (
                    <p className="text-xs text-muted-foreground truncate">{p.channel.display_name}</p>
                  )}
                </div>
                {p.is_op && <Star className="w-3.5 h-3.5 text-warning fill-warning shrink-0" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  allPresences: PresenceWithProfile[];
  myPairUserId: string | null;
  onSwitchChannel: (channelId: string) => void;
  onStartPairing: () => void;
  onCancelPair: () => void;
}

function UserRow({
  presence, isPointed, isMe, channels, allPresences,
  myPairUserId, onSwitchChannel, onStartPairing, onCancelPair,
}: UserRowProps) {
  const displayName = presence.profile?.nickname || presence.profile?.ic_name || presence.profile?.username || '?';
  const isPaired = myPairUserId !== null;

  // Highlight pair partner row
  const isMyPartner = !isMe && presence.user_id === myPairUserId;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm group transition-colors
      ${isMe ? 'bg-primary/5' : isMyPartner ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-muted/50'}
    `}>
      <span className="online-dot-static" />
      <span className={`w-4 text-center text-sm transition-opacity ${isPointed ? 'opacity-100' : 'opacity-0'}`}>
        👉
      </span>
      {presence.is_op && (
        <Star className="w-3.5 h-3.5 text-warning fill-warning shrink-0" />
      )}
      {isMyPartner && (
        <UserCheck className="w-3.5 h-3.5 text-accent shrink-0" />
      )}
      <span className={`flex-1 min-w-0 text-sm ${isMe ? 'text-primary font-semibold' : isMyPartner ? 'text-accent font-semibold' : 'text-foreground'} truncate`}>
        {displayName}
        {isMe && <span className="ml-1 text-xs text-muted-foreground">(คุณ)</span>}
        {isMyPartner && <span className="ml-1 text-xs text-accent/70">[คู่ของคุณ]</span>}
      </span>
      <UserRolesBadges userId={presence.user_id} />
      {presence.profile?.ic_name && presence.profile.ic_name !== displayName && (
        <span className="text-xs text-muted-foreground hidden md:block truncate max-w-24">
          [{presence.profile.ic_name}]
        </span>
      )}

      {/* Switch channel + pair menu — only for self */}
      {isMe && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded border border-transparent hover:border-border transition-colors shrink-0">
              เมนู <ChevronRight className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Channel switch items */}
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
            <DropdownMenuSeparator />
            {/* Pairing options */}
            {isPaired ? (
              <DropdownMenuItem
                onClick={onCancelPair}
                className="text-destructive focus:text-destructive"
              >
                <X className="w-3.5 h-3.5 mr-2" /> ยกเลิกจับคู่
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onStartPairing} disabled={allPresences.filter(p => p.user_id !== presence.user_id).length === 0}>
                <UserCheck className="w-3.5 h-3.5 mr-2" /> จับคู่กับ...
              </DropdownMenuItem>
            )}
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
  allPresences: PresenceWithProfile[];
  myPairUserId: string | null;
  onSwitchChannel: (channelId: string) => void;
  onStartPairing: () => void;
  onCancelPair: () => void;
}

function ChannelSection({
  channel, presences, pointedUserId, myUserId, channels, allPresences,
  myPairUserId, onSwitchChannel, onStartPairing, onCancelPair,
}: ChannelSectionProps) {
  return (
    <div className="mb-1">
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
              allPresences={allPresences}
              myPairUserId={myPairUserId}
              onSwitchChannel={onSwitchChannel}
              onStartPairing={onStartPairing}
              onCancelPair={onCancelPair}
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
    presenceList, presenceByChannel, channels, pointer, myPresence,
    opList, loading, handleSwitchChannel, handleToggleOP,
    handleNextPointer, handleRandomOP,
  } = useQueue();

  // ── Pairing state ──────────────────────────────────────────────
  // myPairUserId: the other user we're paired with (null = no pair)
  const [myPairUserId, setMyPairUserId] = useState<string | null>(null);
  const [pairingPickerOpen, setPairingPickerOpen] = useState(false);

  // Track my current channel to detect room moves
  const myChannelIdRef = useRef<string | null>(null);
  const prevMyPresence = useRef<PresenceWithProfile | null>(null);

  useEffect(() => {
    if (!myPresence) return;
    const prev = prevMyPresence.current;
    // If I moved rooms, cancel pair
    if (prev && prev.channel_id !== myPresence.channel_id && myPairUserId !== null) {
      setMyPairUserId(null);
      toast.info('การจับคู่ถูกยกเลิกเนื่องจากคุณย้ายห้อง');
    }
    prevMyPresence.current = myPresence;
    myChannelIdRef.current = myPresence.channel_id;
  }, [myPresence, myPairUserId]);

  // Watch partner channel changes → cancel if partner moved
  const partnerRef = useRef<string | null>(null);
  partnerRef.current = myPairUserId;

  useEffect(() => {
    if (!myPairUserId) return;
    const partner = presenceList.find(p => p.user_id === myPairUserId);
    if (!partner) {
      // Partner went offline
      setMyPairUserId(null);
      toast.info('คู่ของคุณออกจากระบบ — การจับคู่ถูกยกเลิก');
      return;
    }
    // Partner changed channel from mine
    if (myPresence && partner.channel_id !== myPresence.channel_id) {
      // Only cancel if they were previously in the same channel
      setMyPairUserId(null);
      toast.info(`${partner.profile?.nickname || partner.profile?.username || 'คู่ของคุณ'} ย้ายห้อง — การจับคู่ถูกยกเลิก`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceList]);

  const handleSelectPair = (presence: PresenceWithProfile) => {
    setMyPairUserId(presence.user_id);
    const name = presence.profile?.nickname || presence.profile?.username || '?';
    toast.success(`จับคู่กับ "${name}" สำเร็จ`);
  };

  const handleCancelPair = () => {
    setMyPairUserId(null);
    toast.info('ยกเลิกการจับคู่แล้ว');
  };

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
  const partnerPresence = myPairUserId ? presenceList.find(p => p.user_id === myPairUserId) : null;

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

      {/* Active pair banner */}
      {myPairUserId && partnerPresence && (
        <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-sm border border-accent/40 bg-accent/10">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-accent shrink-0" />
            <span className="text-sm text-accent font-semibold">
              จับคู่กับ: {partnerPresence.profile?.nickname || partnerPresence.profile?.username}
            </span>
            {partnerPresence.channel?.display_name && (
              <span className="text-xs text-muted-foreground">({partnerPresence.channel.display_name})</span>
            )}
          </div>
          <button onClick={handleCancelPair} className="text-xs text-destructive hover:underline shrink-0">
            ยกเลิก
          </button>
        </div>
      )}

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
              allPresences={presenceList}
              myPairUserId={myPairUserId}
              onSwitchChannel={(cid) => {
                handleSwitchChannel(cid);
                toast.success(`ย้ายไป ${channels.find(c => c.id === cid)?.display_name || ''}`);
              }}
              onStartPairing={() => setPairingPickerOpen(true)}
              onCancelPair={handleCancelPair}
            />
          ))}
        </div>
      </div>

      {/* Pairing picker dialog */}
      <PairingPicker
        open={pairingPickerOpen}
        onClose={() => setPairingPickerOpen(false)}
        onSelect={handleSelectPair}
        allPresences={presenceList}
        myUserId={user?.id ?? ''}
      />
    </div>
  );
}
