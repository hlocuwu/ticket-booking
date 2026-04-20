from flask import Flask, request, jsonify
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import threading

app = Flask(__name__)

SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'no-reply@ticket-booking.local')

def send_email_async(to_email, subject, body):
    print(f"--- FAKING EMAIL TO {to_email} ---")
    print(f"Subject: {subject}")
    print(f"Body: {body[:100]}...\n")
    
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("SMTP credentials not set. Simulated email successfully.")
        return
        
    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Successfully sent email to {to_email} via {SMTP_SERVER}")
    except Exception as e:
        print(f"Failed to send real email to {to_email}: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "up", "service": "notification"}), 200

@app.route('/send-email', methods=['POST'])
def send_email_endpoint():
    data = request.json
    if not data or 'to_email' not in data or 'subject' not in data or 'body' not in data:
        return jsonify({"error": "Missing required fields (to_email, subject, body)"}), 400
        
    # Send email in background to not block the request
    threading.Thread(target=send_email_async, args=(
        data['to_email'], 
        data['subject'], 
        data['body']
    )).start()
    
    return jsonify({"message": "Email notification queued successfully"}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8086))
    app.run(host='0.0.0.0', port=port)
