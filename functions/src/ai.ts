import { onRequest } from "firebase-functions/v2/https";

export const aiPreview = onRequest(async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({ error: "No text provided" });
      return;
    }

    // 🔑 Load OpenAI lazily (VERY IMPORTANT)
    const OpenAI = (await import("openai")).default;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Clean the notes, improve clarity, fix math expressions, format nicely.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    res.json({
      result: completion.choices[0].message.content,
    });
  } catch (err: any) {
    console.error("AI PREVIEW ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
