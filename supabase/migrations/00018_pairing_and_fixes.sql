-- 00018: Add paired_with to user_presence, fix OP room, fix join preserving position

-- =============================================
-- 1. PAIRING: Add paired_with_user_id to user_presence
-- =============================================
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS paired_with_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_presence_paired ON user_presence(paired_with_user_id) WHERE paired_with_user_id IS NOT NULL;

-- RPC to pair two users symmetrically
CREATE OR REPLACE FUNCTION public.pair_users(p_user_a UUID, p_user_b UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_presence SET paired_with_user_id = p_user_b WHERE user_id = p_user_a;
  UPDATE user_presence SET paired_with_user_id = p_user_a WHERE user_id = p_user_b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to cancel pair for a user (clears both sides)
CREATE OR REPLACE FUNCTION public.cancel_pair(p_user_id UUID)
RETURNS void AS $$
DECLARE
  partner_id UUID;
BEGIN
  SELECT paired_with_user_id INTO partner_id FROM user_presence WHERE user_id = p_user_id;
  UPDATE user_presence SET paired_with_user_id = NULL WHERE user_id = p_user_id;
  IF partner_id IS NOT NULL THEN
    UPDATE user_presence SET paired_with_user_id = NULL WHERE user_id = partner_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.pair_users(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pair(UUID) TO authenticated;
