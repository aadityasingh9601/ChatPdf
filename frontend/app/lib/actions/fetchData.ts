"use server";

import axios from "axios";
import { createClient } from "../supabase/server";

export const fetchData = async (userId: any) => {
  const supabase = createClient();
  const {
    data: { session },
  } = await (await supabase).auth.getSession();
  console.log("Session data", session);

  const res = await axios.get(
    `http://localhost:8000/api/getpdfs?userId=${userId}`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    },
  );
  console.log(res?.data);
  return {
    success: true,
    message: res.data,
  };
};
