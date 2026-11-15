# 写真を差し替える

初期状態は、音と空間を表したSVG図版です。実在する人物の写真ではありません。

## 1. 写真を置く

`assets/people/` に、例えば `higaki.jpg` と `kanno.jpg` を入れます。JPG・PNG・WebPを使えます。ファイル名の英字の大文字・小文字と拡張子をそろえてください。元のリポジトリでは `dist/assets/people/` です。

目安は横1,200px程度、1枚500KB前後以下。表示枠は基本4:3です。縦長の写真も自動で切り抜かれます。

## 2. image-settings.js を編集

`higaki` の項目を次のように変更します。`kanno` も同じ手順です。

```javascript
higaki: {
  src: "assets/people/higaki.jpg",
  alt: "檜垣智也さんが演奏している様子",
  credit: "写真：撮影者名／提供元",
  position: "50% 30%",
},
```

- `src`：画像への相対パス。
- `alt`：写真に実際に写っている内容。装飾画像なら空文字でも構いません。
- `credit`：撮影者・提供者等。空文字にするとキャプションを非表示にします。
- `position`：切り抜きの中心。`50% 50%` が中央、`50% 30%` は少し上です。

ここだけで、トップページ、アーティスト一覧、人物詳細ページが更新されます。写真パスを間違えた場合は、元の図版へ戻るようにしています。
掲載条件を確認した写真を使用し、必要なクレジットを記載してください。

## ほかのページに画像を追加

記事の好きな位置に下のHTMLを入れられます。画像は画面幅に合わせて縮小されます。

```html
<figure class="person-image person-image-detail">
  <img src="assets/people/your-photo.jpg"
       alt="写真に写っている内容" width="1200" height="900"
       loading="lazy" decoding="async">
  <figcaption>写真の説明・撮影者名</figcaption>
</figure>
```

切り抜かず写真全体を表示する場合は、`img` に `style="aspect-ratio:auto;max-height:none;object-fit:contain"` を追加してください。

## 反映を確認

編集後は同じフォルダーの `index.html` を開いて再読み込みします。以前のLive Serverが動いている場合は停止し、新しいフォルダーから起動し直してください。
端末に保存済みの画像が残る場合は、ブラウザーを再読み込みするか画像ファイル名を変えて `src` を更新してください。
