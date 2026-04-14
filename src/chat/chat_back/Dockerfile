FROM python:3.11-slim

# set workdir
WORKDIR /usr/src/app

# install system deps for asyncpg and libpq
RUN apt-get update && apt-get install -y gcc libpq-dev build-essential curl \
  && rm -rf /var/lib/apt/lists/*

# copy requirements first for caching
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# copy project
COPY . .

# expose port
EXPOSE 8000

# default command to run uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
