# website.url/intsum

import boto3
import json
import os

# --- Import from common Lambda Layer ---
from common.utils import with_cors, parse_body

# --- Client Config ---
REGION = os.environ.get("REGION", "us-gov-west-1")
MODEL_ID = os.environ.get("MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0")

# --- Example Blocks ---
INTSUM_EXAMPLES = """
<example_1>
During this reporting period, the IDF carried out military operations across Gaza, the West Bank, Syria, and Lebanon.
In Gaza, Hamas reported that humanitarian aid remains below the minimum required to meet basic needs and urgently requested assistance ahead of winter storms.
Hamas and the ICRC returned the remains of a suspected Israeli hostage to Israel for identification.
Separately, the Israeli Prime Minister expressed interest in establishing a demilitarized zone in Syria.
In Iran, 12 Afghan nationals were killed during an attempted border crossing, and the Iranian Foreign Minister held a teleconference with the Japanese Prime Minister.
In Iraq, Kurdish factions clashed with protesters, and the Herki tribe prepared for conflict with forces they referred to as “Barzani militias.”
In Yemen, the Southern Transitional Council and Southern Armed Forces mobilized troops in preparation for military operations.
Finally, PAKMIL conducted a security operation which resulted in the deaths of seven TTP militants.
</example_1>

<example_2>
During this reporting period, Hamas announced the recovery of three additional deceased Israeli hostages east of Khan Yunis.
A Hamas Leadership Delegation met with the Turkish Foreign Minister to discuss the Gaza ceasefire agreement, Israeli violations, and denied claims of looting humanitarian aid in Rafah.
Additionally, the IDF and IAF continued strikes and demolition operations in the Gaza Strip.
Separately, Israeli government officials threatened to resume strikes in Lebanon if the Hezbollah re-arms and subsequently attacks Israel.
Iranian officials claimed Iran will accept “realistic negotiations” regarding its nuclear program.
In Iraq, Turkish authorities cut the flow of the Tigris River into Iraq and Muqtada al-Sadr reiterated his stance to boycott the 2025 Iraqi Parliamentary Elections.
Finally, Pakistan security forces conducted security operations targeting militant group bed down locations in Khyber Pakhtunkhwa Province.
</example_2>

<example_3>
During this reporting period, Hamas militants and Red Crescent teams continued searching for the remains of eight remaining Israeli hostages.
In response to the return of three Israeli bodies, Israel released the remains of 45 Palestinian prisoners, bringing the total repatriated to 270. Additionally, Israel conducted airstrikes across several areas in Gaza, killing at least two individuals.
Separately, the Atomic Energy Organization of Iran confirmed Iran and Russia agreed to build eight new nuclear power points, four of which will be in Bushehr Province.
Supreme Leader Khamenei claimed if the U.S. withdraws from the region and “abandons support” for Israel, nuclear negotiations will continue.
Finally, the Kata’ib Hezbollah Brigades spokesperson called on members to support Popular Mobilization Units electoral candidates in the upcoming 2025 Iraqi elections.
</example_3>
"""

RFI_EXAMPLES = """
Summaries should be done with brevity and kept to a single paragraph like the examples below. Do not list every single report. Synthesize like events.
<EXAMPLE 1>
On 14 December 2025, a mass shooting at the "Hanukkah by the Sea" event in Bondi Beach, Sydney, Australia, left 16 dead and dozens injured. The attackers, Naveed Akram and Sajid Akram, were identified by Australian police, with Naveed injured and under observation, while Sajid was killed at the scene. Israeli officials condemned the attack, with Prime Minister Netanyahu accusing Australia of fueling anti-Semitism and warning of potential copycat actions. Mossad reportedly issued prior warnings about threats to Australia's Jewish community, and Israeli authorities are investigating possible links to Iran, Hezbollah, Hamas, or Lashkar-e-Taiba. Iran condemned the attack, rejecting terrorism and violence, while Israeli officials criticized Tehran's statement, citing Iran's history of targeting Jewish and Israeli communities globally. Social media celebrated Ahmed Al-Ahmad, a Syrian refugee who intervened during the attack, as a hero in the Arab world. 
</EXAMPLE 1>

<EXAMPLE 2>
The Hamas-affiliated Deterrence Force intensified operations against anti-Hamas clans and factions in the Gaza Strip. The Deterrence Force operates a Telegram page where it issues warnings and reports on arrests, raids, and executions of individuals accused of collaboration with Israel. The Force claims to protect morals, security, and dignity in the Gaza Strip while targeting weapons and hideouts of "mercenaries." Despite the death of Yasser Abu Shabab, anti-Hamas clans operating in Israeli-controlled areas vowed to continue their opposition, with reports indicating their strength has grown by 400 men since the ceasefire began. Leaders of these factions, including Hossam al-Astal and Ghassan al-Dahini, have further pledged to persist in their fight against Hamas in the "new Gaza."
</EXAMPLE 2>

<EXAMPLE 3>
According to publicly available information (PAI), Hamas alleged that Israeli operations have resulted in the deaths of 107 children, 39 women, and 9 elderly individuals since the start of the ceasefire, with 58% of the victims being women, children, and the elderly. Additionally, the Gaza Ministry of Health reported that 12 children and 8 women were among 33 civilians killed in a 24-hour period. The Gaza Center for Human Rights claimed that 130 children and 54 women were killed in the 47 days since the ceasefire began. Finally, Al Jazeera reported that an IAF strike in Gaza City killed a 70-year-old woman and her son, allegedly targeted by a drone.
</EXAMPLE 3>

<EXAMPLE 4>
Between September and October 2025, surveys conducted by Palestinian non-governmental organizations revealed shifting public opinion in the West Bank and Gaza Strip regarding the conflict and Hamas' popularity. A JMCC poll showed declining optimism about Hamas' success and growing expectations of reduced support for Hamas. Separately, the PCPSR survey indicated slightly improved optimism about ending the conflict and slight gains in Hamas' popularity. Meanwhile, Hamas-aligned security forces in Gaza warned residents against participating in unauthorized polls, citing concerns about external exploitation. Finally, severe flooding in November 2025 reportedly displaced thousands of Gazans, fueling resentment over perceived inadequate aid and international response.
</EXAMPLE 4>
"""

# --- Base System Prompt (Instructions only) ---
BASE_SYSTEM_PROMPT = """You are a Military Intelligence Analyst for the 513th MI BDE. Your task is to draft the "Summary" section of a Daily OSINT Reporting Roll-Up.

Guidelines:
1.  **Voice:** Professional, objective, concise, and military-standard (Active voice).
2.  **Structure:** * Start with a general sentence: "During this reporting period, [Major Actor] conducted [Action] in [Region]..."
    * Group updates by country or region (e.g., "In Gaza...", "Separately, in Iran...", "Finally, in Pakistan...").
    * Do NOT list every single report. Synthesize similar events.
    * Do NOT use bullet points. Use paragraphs.
    * Do NOT include citations or timestamps in the summary.
3.  **Accuracy:** Strictly stick to the provided reports. Do not hallucinate outside info.
4.  Here are examples of the perfect summary style you must emulate:
"""

# --- Initialize Client ---
bedrock_client = boto3.client("bedrock-runtime", region_name=REGION)

def handle_generate_summary(event):
    """
    Handles generating an INTSUM summary from a list of report bodies.
    Accepts 'report_type' in body: "INTSUM" or "RFI".
    """
    body = parse_body(event)
    
    # 1. Validation: Expecting a list of strings under "reports"
    reports = body.get("reports")
    if not reports or not isinstance(reports, list) or len(reports) == 0:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Request body must contain a non-empty 'reports' list."})
        }

    # 2. Determine Report Type and Select Examples
    report_type = body.get("report_type", "INTSUM")
    
    if report_type == "RFI":
        selected_examples = RFI_EXAMPLES
    else:
        selected_examples = INTSUM_EXAMPLES
        
    # Combine Base Prompt with Selected Examples
    final_system_prompt = f"{BASE_SYSTEM_PROMPT}\n{selected_examples}"

    # 3. Construct the User Prompt
    # We join all reports into a single text block for the model to digest.
    formatted_reports = "\n---\n".join([f"REPORT {i+1}: {r}" for i, r in enumerate(reports)])
    
    user_message = f"""Here are the raw OSINT reports collected for today's roll-up.
Analyze them and write the summary paragraph following the guidelines and examples provided in the system prompt.

<raw_reports>
{formatted_reports}
</raw_reports>

Draft the summary now:"""

    # 4. Construct Bedrock Payload
    bedrock_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "system": final_system_prompt,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": user_message}]
            }
        ],
        "max_tokens": 1000,
        "temperature": 0.3, # Lower temperature for more factual/consistent output
        "top_p": 0.9,
    }

    try:
        # 5. Invoke Model
        resp = bedrock_client.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(bedrock_body).encode("utf-8"),
        )
        
        # 6. Parse Response
        payload = json.loads(resp["body"].read().decode("utf-8"))
        parts = [p.get("text", "") for p in payload.get("content", []) if p.get("type") == "text"]
        summary_text = "\n".join(parts).strip()
        
        usage = payload.get("usage", {})
        
        # 7. Return Result
        return {
            "statusCode": 200,
            "body": json.dumps({
                "summary": summary_text,
                "usage": usage,
                "type_used": report_type
            })
        }

    except Exception as e:
        print(f"Bedrock invocation failed: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"Model generation failed: {str(e)}"})
        }

def lambda_handler(event, context):
    """
    Main router.
    """
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    response = None
    try:
        http_method = event.get("httpMethod")
        path = event.get("path", "")

        # Route POST requests
        if http_method == "POST":
            response = handle_generate_summary(event)
        else:
            response = {
                "statusCode": 405, 
                "body": json.dumps({"message": "Method Not Allowed"})
            }
        
        return with_cors(response)

    except Exception as e:
        return with_cors({
            "statusCode": 500, 
            "body": json.dumps({"message": f"Server error: {str(e)}"})
        })