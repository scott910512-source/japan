import { createClient } from '@supabase/supabase-js';

/* Supabase 연결.
 *
 * anon 키는 브라우저에 노출되는 게 정상이다 — 데이터를 지키는 건 키가 아니라
 * 테이블에 걸어 둔 RLS(본인 행만 읽기·쓰기)다. service_role 키는 절대 여기 넣지 마라.
 * 그건 RLS를 무시하는 마스터 키다. */
const SUPABASE_URL = 'https://ifjgngkkozsiyoafhlkb.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // 비밀번호 재설정 링크로 돌아왔을 때 세션을 잡는다
    },
  })
  : null;

// 비밀번호 재설정 메일의 돌아올 주소. 배포 경로(/japan/)를 그대로 쓴다.
export function redirectUrl() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
