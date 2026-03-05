import boto3
import json

bedrock = boto3.client("bedrock-agent-runtime")

def lambda_handler(event, context):

    body = json.loads(event.get("body", "{}"))
    query = body.get("query", "")

    system_prompt = """
You are a senior software architect.

Using the provided context and the user's requirement:
1. Explain the solution briefly.
2. Estimate development time in days.
3. Provide suggested Jira story points.
4. Suggest a breakdown of Jira tasks if needed.

Be concise and structured.

User requirement:
"""

    response = bedrock.retrieve_and_generate(
        input={
            "text": system_prompt + query
        },
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": "JQRNOTEFKO",
                "modelArn": "arn:aws:bedrock:us-east-1:682684724727:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
                "retrievalConfiguration": {
                    "vectorSearchConfiguration": {
                        "numberOfResults": 5
                    }
                },
                "generationConfiguration": {
                    "promptTemplate": {
                        "textPromptTemplate": """
You are an expert software engineer.

Use the retrieved documentation context to answer the question.

Provide the response in this format:

Solution:
<short explanation>

Estimated Development Time:
<number of days>

Suggested Story Points:
<number>

Suggested Jira Tasks:
- Task 1
- Task 2
- Task 3

Context:
$search_results$

User Query:
$input$
"""
                    }
                }
            }
        }
    )

    answer = response["output"]["text"]

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps({"answer": answer})
    }