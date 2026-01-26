import { supabase } from "./supabaseClient";

export async function uploadQuestionImage(file: File) {
  const fileExt = file.name.split(".").pop() || "png";
  const fileName = `${crypto.randomUUID()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("question-images")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("question-images")
    .getPublicUrl(fileName);

  return data.publicUrl;
}
