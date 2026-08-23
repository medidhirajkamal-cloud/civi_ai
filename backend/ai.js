export async function chatWithAI(message) {

    if (!message || !message.trim()) {
        return "Please enter a message.";
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return "AI key is not configured. The basic civic assistant is still available.";
    }

    try {

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },

                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `
You are a helpful Citizen Complaint Assistant.

Help citizens with civic complaints, complaint categories,
priorities, complaint submission, status and account guidance.

Citizen message:
${message}
`
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const text = await response.text();

        console.log("Gemini status:", response.status);

        if (!response.ok) {
            console.error("Gemini response:", text);

            return "The AI service is currently unavailable.";
        }

        const data = JSON.parse(text);

        return (
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Sorry, I could not understand that."
        );

    } catch (error) {

        console.error("AI error:", error);

        return "The AI service is currently unavailable.";
    }
}