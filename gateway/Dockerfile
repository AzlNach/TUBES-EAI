FROM python:3.9-slim

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy ALL source code including schema.py
COPY . .

# Expose port
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]