export type Database = {
  public: {
    Tables: {
      admin_emails: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
      }
      election_notes: {
        Row: {
          id: string
          election_id: string
          content: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          election_id: string
          content: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          election_id?: string
          content?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      system_config: {
        Row: {
          id: string
          logo_url: string | null
          primary_color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          logo_url?: string | null
          primary_color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          logo_url?: string | null
          primary_color?: string
          created_at?: string
          updated_at?: string
        }
      }
      villages: {
        Row: {
          id: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          is_active?: boolean
          created_at?: string
        }
      }
      election_groups: {
        Row: {
          id: string
          title: string
          description: string | null
          group_type: 'delegate' | 'officer'
          status: 'waiting' | 'active' | 'closed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          group_type: 'delegate' | 'officer'
          status?: 'waiting' | 'active' | 'closed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          group_type?: 'delegate' | 'officer'
          status?: 'waiting' | 'active' | 'closed'
          created_at?: string
          updated_at?: string
        }
      }
      elections: {
        Row: {
          id: string
          title: string
          election_type: 'delegate' | 'officer'
          position: string | null
          village_id: string | null
          max_selections: number
          round: number
          status: 'waiting' | 'registering' | 'active' | 'closed'
          winning_criteria: WinningCriteria
          series_id: string | null
          series_title: string | null
          group_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          election_type: 'delegate' | 'officer'
          position?: string | null
          village_id?: string | null
          max_selections: number
          round?: number
          status?: 'waiting' | 'registering' | 'active' | 'closed'
          winning_criteria?: WinningCriteria
          series_id?: string | null
          series_title?: string | null
          group_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          election_type?: 'delegate' | 'officer'
          position?: string | null
          village_id?: string | null
          max_selections?: number
          round?: number
          status?: 'waiting' | 'registering' | 'active' | 'closed'
          winning_criteria?: WinningCriteria
          series_id?: string | null
          series_title?: string | null
          group_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      candidates: {
        Row: {
          id: string
          election_id: string
          name: string
          vote_count: number
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          name: string
          vote_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          election_id?: string
          name?: string
          vote_count?: number
          created_at?: string
        }
      }
      voter_codes: {
        Row: {
          id: string
          code: string
          code_type: 'delegate' | 'officer'
          accessible_elections: string[]
          village_id: string | null
          is_used: boolean
          voter_name: string | null
          used_at: string | null
          first_login_at: string | null
          last_login_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          code_type: 'delegate' | 'officer'
          accessible_elections?: string[]
          village_id?: string | null
          is_used?: boolean
          voter_name?: string | null
          used_at?: string | null
          first_login_at?: string | null
          last_login_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          code_type?: 'delegate' | 'officer'
          accessible_elections?: string[]
          village_id?: string | null
          is_used?: boolean
          voter_name?: string | null
          used_at?: string | null
          first_login_at?: string | null
          last_login_at?: string | null
          created_at?: string
        }
      }
      votes: {
        Row: {
          id: string
          election_id: string
          candidate_id: string
          voter_code_id: string
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          candidate_id: string
          voter_code_id: string
          created_at?: string
        }
        Update: {
          id?: string
          election_id?: string
          candidate_id?: string
          voter_code_id?: string
          created_at?: string
        }
      }
    }
  }
}

// 당선 기준 타입
export type WinningCriteria = 
  | { type: 'plurality' } // 최다 득표
  | { type: 'absolute_majority' } // 절대 과반수 (50% 초과)
  | { 
      type: 'percentage'
      percentage: number // 66.67 (2/3), 50 (과반) 등
      base: 'attended' | 'issued' // 참석자 기준 or 발급 코드 기준
    };
