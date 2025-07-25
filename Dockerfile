FROM node:20-bookworm-slim

# タイムゾーンを日本時間に設定
ENV TZ=Asia/Tokyo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get update && apt-get install tini libpango1.0-dev libcairo2-dev libjpeg-dev libgif-dev build-essential git ca-certificates --no-install-recommends -y && apt-get clean && rm -rf /var/lib/apt-get/lists/*

ARG enable_mecab=1

RUN if [ $enable_mecab -ne 0 ]; then apt-get update \
  && apt-get install mecab libmecab-dev mecab-ipadic-utf8 make curl xz-utils file sudo --no-install-recommends -y \
  && apt-get clean \
  && rm -rf /var/lib/apt-get/lists/* \
  && cd /opt \
  && git clone --depth 1 https://github.com/yokomotod/mecab-ipadic-neologd.git \
  && cd /opt/mecab-ipadic-neologd \
  && ./bin/install-mecab-ipadic-neologd -n -y \
  && rm -rf /opt/mecab-ipadic-neologd \
  && echo "dicdir = /usr/lib/x86_64-linux-gnu/mecab/dic/mecab-ipadic-neologd/" > /etc/mecabrc \
  && apt-get purge git make curl xz-utils file -y; fi

WORKDIR /ai

# package.jsonとpackage-lock.jsonを先にコピーしてキャッシュを活用
COPY package*.json ./
RUN npm install

# ソースコードをコピーしてビルド
COPY . .

# ビルド用のダミーconfig.jsonを作成
RUN echo '{"host":"http://host.docker.internal:3000","i":"dummy","notingEnabled":"false","keywordEnabled":"false","chartEnabled":"false","reversiEnabled":"false","serverMonitoring":"false"}' > config.json

RUN npm run build

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD npm start
