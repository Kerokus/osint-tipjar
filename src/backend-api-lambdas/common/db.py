import os
import psycopg2

def get_db_connection():
    """
    Establishes and returns a connection to the PostgreSQL database.
    Reads connection details from the Lambda function's environment variables.
    """
    try:
        conn = psycopg2.connect(
            host=os.environ['DB_ENDPOINT'],
            user=os.environ['DB_USERNAME'],
            password=os.environ['DB_PASSWORD'],
            dbname=os.environ['DB_NAME'],
            port=os.environ.get('DB_PORT', 5432)
        )
        return conn
    except KeyError as e:
        print(f"ERROR: Missing required environment variable: {e}")
        raise
    except Exception as e:
        print(f"ERROR: Could not connect to PostgreSQL instance. {e}")
        raise