# website.url/countries

import json
import psycopg2
from psycopg2.extras import RealDictCursor

# --- Common Lambda Layer ---
from common.db import get_db_connection
from common.utils import with_cors

def search_locations(cur, country, location):
    """
    Searches for locations based on country and location names,
    returning a list of matching results.
    """
    # Prepare the LIKE pattern in Python
    like_pattern = f"% {location} %"

    sql = """
        SELECT
            l.location,
            l.mgrs,
            p.province,
            c.country
        FROM locations l
        JOIN provinces p ON l.province_id = p.id
        JOIN countries c ON p.country_id = c.id
        WHERE lower(' ' || l.location || ' ') LIKE lower(%s)
          AND lower(c.country) = lower(%s)
        ORDER BY l.location ASC;
    """
    # Pass the prepared pattern as a parameter
    cur.execute(sql, (like_pattern, country))
    results = cur.fetchall()
    return {"statusCode": 200, "body": json.dumps(results, default=str)}

# --- Lambda Entry Point ---

def lambda_handler(event, context):
    """
    Handles GET requests to the /countries resource.
    Expects 'country' and 'location' as query string parameters.
    """
    # Handle CORS preflight requests
    if event.get("httpMethod") == "OPTIONS":
        return with_cors(None)

    # This endpoint only accepts GET requests
    if event.get("httpMethod") != "GET":
        return with_cors({'statusCode': 405, 'body': json.dumps({'message': 'Method Not Allowed'})})

    conn = None
    try:
        # Extract parameters from the query string
        qp = event.get("queryStringParameters") or {}
        country = qp.get("country")
        location = qp.get("location")

        # Validate that both required parameters are present
        if not country or not location:
            return with_cors({
                "statusCode": 400,
                "body": json.dumps({"message": "Both 'country' and 'location' query string parameters are required."})
            })

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        response = search_locations(cur, country, location)
        return with_cors(response)

    except psycopg2.Error as e:
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Database error: {str(e)}"})})
    except Exception as e:
        return with_cors({"statusCode": 500, "body": json.dumps({"message": f"Server error: {str(e)}"})})
    finally:
        if conn:
            conn.close()