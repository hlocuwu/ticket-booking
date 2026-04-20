FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
ENV FLASK_APP=main.py
ENV PORT=8086
EXPOSE 8086
CMD ["python", "main.py"]
