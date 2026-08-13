import { createClient } from "../supabase/server"

export async function getAuthHeaders() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) throw new Error("Not authenticated!")
    
    return {
        headers: {
            Authorization: `Bearer ${session.access_token}`
        }
    }
}