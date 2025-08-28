-- Add recipient_id field to messages table
-- This enables proper direct messaging functionality

-- Add the recipient_id column to messages table
ALTER TABLE messages 
ADD COLUMN recipient_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Create index for recipient queries
CREATE INDEX messages_recipient_idx ON messages (recipient_id);

-- Add comment to document the change
COMMENT ON COLUMN messages.recipient_id IS 'The recipient user ID for direct messages';
