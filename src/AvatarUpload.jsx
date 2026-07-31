import { useState, useRef } from 'react';
import { supabase } from './supabaseClient'; // adjust path to match your project

/**
 * AvatarUpload
 * Lets the signed-in member upload/replace their own profile photo.
 * Requires:
 *  - `avatars` storage bucket (already created)
 *  - `avatar_url` column on `members` (already created)
 *  - RLS policies restricting each user to their own folder: {user_id}/... (already created)
 *
 * Usage:
 *   <AvatarUpload userId={session.user.id} currentAvatarUrl={member.avatar_url}
 *     onUploaded={(url) => setMember({ ...member, avatar_url: url })} />
 */
export default function AvatarUpload({ userId, currentAvatarUrl, onUploaded }) {
  const [preview, setPreview] = useState(currentAvatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB, matches bucket config

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG, WEBP, or HEIC image.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image must be smaller than 8MB.');
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreview(localPreviewUrl);
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('members')
        .update({ avatar_url: bustedUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setPreview(bustedUrl);
      onUploaded?.(bustedUrl);
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setError('Upload failed. Please try again.');
      setPreview(currentAvatarUrl || null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.avatarWrap} onClick={() => !uploading && fileInputRef.current?.click()}>
        {preview ? (
          <img src={preview} alt="Profile" style={styles.avatarImg} />
        ) : (
          <div style={styles.avatarPlaceholder}>+</div>
        )}
        {uploading && <div style={styles.uploadingOverlay}>Uploading…</div>}
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={styles.button}
      >
        {preview ? 'Change photo' : 'Add photo'}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    overflow: 'hidden',
    cursor: 'pointer',
    position: 'relative',
    border: '2px solid #7A1F3D',
    background: '#f5f0f2',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    color: '#7A1F3D',
  },
  uploadingOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    textAlign: 'center',
    padding: 4,
  },
  button: {
    padding: '8px 20px',
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(135deg, #7A1F3D, #5c1730)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
  },
};
