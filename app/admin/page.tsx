import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import Admin from "@/components/Admin";
export const dynamic="force-dynamic";
export default async function AdminPage(){const s=await createClient();
    const{data:{user}}=await s.auth.getUser();
    const admins=(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase());
    if(!user?.email||!admins.includes(user.email.toLowerCase()))redirect("/admin/login");
    return <Admin email={user.email}/> }