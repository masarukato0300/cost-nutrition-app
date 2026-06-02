import { NextResponse } from "next/server";

type SupabaseUser = {
  id: string;
  email?: string;
};

type ShopMember = {
  shop_id: string;
  role: string;
};

type UserProfile = {
  store_id: string;
  role: string;
};

type ManagementAiRequest = {
  featureName?: string;
  summary?: unknown;
  diagnosisAnswers?: Record<string, string | string[]>;
};

function envConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabaseサーバー環境変数が未設定です。");
  if (!openaiApiKey) throw new Error("OPENAI_API_KEYが未設定です。");
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceRoleKey, openaiApiKey };
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("ログイン情報がありません。");
  return match[1];
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(fallbackMessage, payload);
    throw new Error((payload as { message?: string; error_description?: string }).message || (payload as { error_description?: string }).error_description || fallbackMessage);
  }
  return payload as T;
}

async function getSupabaseUser(supabaseUrl: string, serviceRoleKey: string, accessToken: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  return readJson<SupabaseUser>(response, "ログインユーザーを確認できませんでした。");
}

async function getUserShop(supabaseUrl: string, serviceRoleKey: string, userId: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/shop_members?user_id=eq.${encodeURIComponent(userId)}&select=shop_id,role&limit=1`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });
  let member: ShopMember | undefined;
  if (response.ok) {
    const rows = await readJson<ShopMember[]>(response, "店舗メンバー情報を確認できませんでした。");
    member = rows[0];
  } else {
    const errorPayload = await response.json().catch(() => ({}));
    console.warn("shop_members lookup failed; falling back to user_profiles", errorPayload);
  }
  if (!member) {
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(userId)}&select=store_id,role&limit=1`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    });
    const profiles = await readJson<UserProfile[]>(profileResponse, "店舗メンバー情報を確認できませんでした。");
    const profile = profiles[0];
    if (profile) {
      member = { shop_id: profile.store_id, role: profile.role };
    }
  }
  if (!member) throw new Error("このユーザーに紐づく店舗がありません。");
  if (!["owner", "manager"].includes(member.role)) throw new Error("AI経営判断を実行できる権限がありません。");
  return member;
}

function compactPayload(body: ManagementAiRequest) {
  return {
    summary: body.summary,
    diagnosisAnswers: body.diagnosisAnswers || {},
  };
}

async function writeAiUsageLog(
  supabaseUrl: string,
  serviceRoleKey: string,
  params: {
    shopId: string;
    userId: string;
    featureName: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  },
) {
  await fetch(`${supabaseUrl}/rest/v1/ai_usage_logs`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      shop_id: params.shopId,
      user_id: params.userId,
      feature_name: params.featureName,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost: 0,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const { supabaseUrl, serviceRoleKey, openaiApiKey } = envConfig();
    const accessToken = bearerToken(request);
    const user = await getSupabaseUser(supabaseUrl, serviceRoleKey, accessToken);
    const member = await getUserShop(supabaseUrl, serviceRoleKey, user.id);
    const body = await request.json() as ManagementAiRequest;
    const model = process.env.OPENAI_MANAGEMENT_MODEL || "gpt-4o-mini";
    const featureName = body.featureName || "management_decision_comment";
    const payload = compactPayload(body);

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "あなたは、洋菓子店・ケーキ屋・パン屋など小規模店舗向けの経営伴走AIです。",
              "単なる売上アップではなく、店主が無理なく続けながら利益を残す経営判断を支援してください。",
              "数値計算はアプリ側で完了済みです。AIは分類、要約、説明、施策提案だけを行ってください。",
              "AIに渡されるのは、集計済みの売上・原価・粗利・廃棄、商圏の件数要約、診断回答だけです。レシピ詳細、CSV全文、顧客個人情報は前提にしないでください。",
              "summary.commercialArea がある場合は必ず商圏判断に使ってください。分析半径、周辺ケーキ屋・洋菓子店件数、パン屋件数、カフェ件数、代表的な近隣競合名、評価、口コミ件数、住所要約が含まれます。",
              "diagnosisAnswersは任意回答です。空欄は無視し、入力済みの回答だけを重視してください。purposeは店の存在意義、concernはしんどさ、customerValueは顧客が商品以外に買っている価値、localSupportersは店がなくなると困る人、noCompromiseは守りたい品質や価値観、smallExperimentは今週試せそうな実験です。",
              "solo系はひとり店主の負担、family系は夫婦・家族経営の役割、brand系は修行経験やブランド価値、weather系は天気・イベント・流行の影響、location系は立地ハンデや目的来店導線に関する回答です。",
              "最初に storeTypes, locationType, trainingBackground, externalFactors, teamStructure, currentScale, futureScale, mainGoal, decisionStage から、店舗タイプと目指す方向を推定してください。",
              "storeTypesは複数選択です。ひとり店主、夫婦・家族経営、修行背景、本格派、天気・イベント影響、立地ハンデ、目的来店型、地域密着型、ギフト・焼き菓子中心、予約・オーダー中心など、複数の特徴が重なる前提で優先順位を変えてください。",
              "ひとり店主モードなら、作業量を増やさない商品整理、予約化、営業日設計、廃棄削減を重視してください。",
              "夫婦・家族経営モードなら、役割分担、意思決定、家庭への負担、接客・製造・会計の偏りを重視してください。",
              "有名店・ホテル修行やフランス・海外修行がある場合は、技術やブランド価値を安売りしない価格設計、体験価値、見せ方を重視してください。",
              "本格派・ブランド価値重視なら、値引きより価値訴求、予約導線、限定性、品質を守れる商品数を重視してください。",
              "世間・天気・イベントに左右されやすい、地域イベント依存型、季節商品依存型、SNS・流行影響型なら、波を前提にした仕込み量、予約、定番商品の安定性、イベント後の反動を重視してください。",
              "立地ハンデ、ビル上階、路地裏、幹線道路から入りにくい、車が止まりにくい、目立たない外観、駐車場がわかりにくい、通りすがり客が少ない場合は、通行量に頼らず目的来店・予約・ギフト・SNS導線・看板や導線改善を重視してください。",
              "商圏内のケーキ屋・洋菓子店が多い場合は、単純な値下げではなく、用途、予約、ギフト、看板商品、世界観、目的来店で差別化してください。",
              "商圏内のケーキ屋・洋菓子店が少ない場合は、認知拡大と「何の店か」が伝わる導線を優先してください。",
              "カフェやパン屋が多い場合は、日常利用、手土産、焼き菓子、取り置き導線、買いやすい価格帯を考慮してください。",
              "立地が悪く競合も多い場合は、価格競争ではなく目的来店型を強く提案してください。Googleマップ、外観写真、入口写真、駐車場案内、用途が一瞬で伝わる看板を重視してください。",
              "目的来店型にしたい場合は、予約商品、ギフト、限定商品、記念日、LINE導線、来店理由づくりを重視してください。",
              "地域密着型なら、常連の安心感、家族行事、地域イベント、日常使い、無理なく続く商品構成を重視してください。",
              "ギフト・焼き菓子中心なら、箱・包材原価、賞味期限、単価、まとめ買い、手土産導線、季節イベントを重視してください。",
              "予約・オーダー商品中心なら、製造枠、手間時間原価、前受け、キャンセル、写真送付やLINE導線を重視してください。",
              "立地は住宅街、駅前、観光地、郊外ロードサイド、競合多数、常連中心などを読み取り、商圏要約があれば競合件数の多さも踏まえてください。",
              "修行背景や得意分野がある場合は、無理に捨てる提案ではなく、強みとして残すか、利益が残る形へ変える提案にしてください。",
              "外部要因は材料高騰、人手不足、競合出店、客数減、客単価変化、季節性、イベントなどとして整理してください。",
              "夫婦2人の小規模店、スタッフありの地域店、複数店舗志向、通販拡大志向など、規模感と人員体制によって質問と施策の優先順位を変えてください。",
              "最初から売上アップを提案しないでください。忙しさ、体力、品質、地域との関係、夫婦やスタッフの役割バランス、採用力、設備、人件費が重要な制約です。",
              "協働解決者として、本人たちが何を大切にしているか、どこに無理があるか、何が本当の制約か、どこに既に強みがあるか、次に何を確認すべきかを整理してください。",
              "提案は「増やす」だけでなく、商品数削減、営業日や予約導線の調整、焼き菓子比率、廃棄低減、値上げ、役割再設計なども含めてください。",
              "将来拡大したい店には、標準化、人員配置、製造能力、予約導線、商品カテゴリ別の粗利、再現性の確認も含めてください。",
              "今の規模を守りたい店には、商品整理、値上げ、予約化、廃棄削減、負担の大きい商品の見直し、休日確保を優先してください。",
              "パン屋なら日々の製造数、朝の負荷、廃棄、商品数、定番回転を重視してください。",
              "焼き菓子店ならギフト導線、賞味期限、包材原価、単価、まとめ買い、季節イベントを重視してください。",
              "カフェ併設なら席回転、滞在価値、客単価、厨房とホールの負担、テイクアウト比率を重視してください。",
              "予約・オーダー中心なら予約導線、前受け、製造枠、キャンセル、手間時間原価を重視してください。",
              "通販・ギフト中心なら箱・送料・梱包・リピート導線・製造標準化を重視してください。",
              "売れたかだけでなく、楽だったか、続けられるか、負担が減るか、常連がどう感じるかを確認する小さな実験として提案してください。",
              "入力された店舗タイプ複数選択、立地、修行背景、外部要因、人員体制、現状規模、将来規模、目標、判断段階、目的、しんどさ、制約、強み、顧客価値、役割バランス、理想の働き方、負担の大きい商品、守りたい品質、地域の支持者、小さな実験案を必ず踏まえてください。",
              "数字上は良くても、その店の制約や守りたい価値に反する施策は優先しないでください。",
              "売上が下がっていても、すぐに努力不足や商品力不足と決めつけないでください。",
              "原価、粗利、廃棄、製造時間、立地、人員、価値観、外部要因を分けて考えてください。",
              "まず、どこに無理があるか、何が本当の制約か、既にある強みは何かを整理してください。",
              "値下げや商品数追加を安易に提案しないでください。",
              "提案には、減らす、絞る、限定化する、予約制にする、値上げする、日持ちする商品に寄せる選択肢も含めてください。",
              "売れている商品と利益が残る商品を分けて考えてください。",
              "お客様が本当に買っている価値を、専門用語ではなく小規模店の経営者が読める日本語で言語化してください。",
              "回答が不足している場合は、無理に断定せず、次に答えると判断が進む問いを出してください。",
              "断定口調や上から目線は避け、経営者夫婦が自分たちの強みを再発見できる言葉にしてください。",
              "他店舗との比較や断定的な財務保証は避け、確認すべき観点を明確にしてください。",
              "ひとり店主の場合は、売上拡大よりも続けられる経営を優先し、SNS投稿、イベント出店、新商品追加など作業が増える提案は慎重にしてください。休めない構造、当日対応、商品数過多、仕込み負担を重視し、ひとりでも回る商品構成、予約制、限定販売、焼き菓子比率の見直しを提案してください。",
              "夫婦・家族経営の場合は、役割バランス、負担の偏り、意思決定の曖昧さを考慮し、家族関係を悪化させるような無理な売上拡大提案は避けてください。",
              "修行経験・ブランド型の場合は、技術力や修行経験を軽視せず、安易な値下げや簡略化を避け、価値の伝え方、高単価商品、予約商品、看板商品を重視してください。本格的な商品名や製法は一般のお客様に伝わる言葉へ翻訳する提案をしてください。",
              "世間・天気・イベントに左右されやすい場合は、売上低下をすぐに店の問題と決めつけず、外部要因と自店要因を分けてください。雨、猛暑、寒波、地域イベント、給料日前後、SNS流行、物価高感を考慮し、外部要因が強い日は売上より廃棄を減らし粗利を守る提案を優先してください。",
              "立地ハンデ店舗の場合は、通りすがり客を増やす提案だけをせず、探してでも来てもらう理由を作る提案を優先してください。Googleマップ、外観写真、駐車場案内、入口写真、道順案内、用途訴求の看板、予約商品、ギフト、オーダー商品を重視してください。",
              "AIコメント出力は、入力データがない項目を無理に出さず、自然に省略してください。空の配列や空文字で返しても構いません。",
              "JSONで summary, store_type_insight, number_alerts, owner_constraints, external_factor_possibilities, location_area_insights, price_actions, growth_actions, reduce_or_reserve_candidates, one_week_experiments, no_need_actions, questions_to_confirm, friendly_frameworks, frameworks を返してください。",
              "summaryでは、推定した店舗タイプ、規模感、目標、数字から見えること、数字だけでは判断しない前提を短く述べてください。",
              "store_type_insightでは、この店のタイプ・立地・人員体制から見える経営上の特徴を2〜4文で述べてください。",
              "number_alertsでは、数字から見える注意点を3つ以内で返してください。原価率、粗利、廃棄、売上と利益のズレを中心にしてください。",
              "owner_constraintsでは、店主・お店の制約を3つ以内で返してください。体力、人員、製造時間、家族の役割、品質へのこだわりを含めてください。",
              "external_factor_possibilitiesでは、天気、イベント、物価高、SNS流行、競合、給料日前後など、外部要因の可能性を3つ以内で返してください。",
              "location_area_insightsでは、立地・商圏から見える特徴を3つ以内で返してください。商圏データがない場合は空配列にしてください。",
              "price_actionsでは、値上げ候補を3つ以内で返してください。商品名やカテゴリが不明な場合は、候補の考え方だけにしてください。",
              "growth_actionsでは、伸ばすべき商品を3つ以内で返してください。売れているだけでなく利益が残るかも分けてください。",
              "reduce_or_reserve_candidatesでは、減らす、限定化、予約制にする候補を3つ以内で返してください。手間や廃棄が大きいものを優先してください。",
              "one_week_experimentsでは、今週試せる小さな実験を3つ以内で返してください。各項目は、実験内容、見る数字または反応、やめる判断基準を含めてください。",
              "no_need_actionsでは、無理にやらなくていいことを3つ以内で返してください。作業が増えるSNS、イベント、新商品追加、値下げなどを必要に応じて含めてください。",
              "questions_to_confirmでは、次に答えると判断が一段進む問いを3つ以内で返してください。一般論ではなく、回答済み内容を踏まえた問いにしてください。",
              "friendly_frameworksには、専門用語を前面に出さない見出しで strengths, weaknesses, chances, risks, priority_targets, products_to_grow, products_to_review, improvement_ideas, monthly_top3_actions を配列で返してください。",
              "frameworksには、詳細確認用として swot, three_c, four_p, stp, tows を必ず含め、可能なら seven_s, pest, plc, business_domain, game_theory も含めてください。専門フレーム内も日本語で短くしてください。",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    });
    const openaiPayload = await readJson<{
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    }>(openaiResponse, "AI経営コメントを作成できませんでした。");

    await writeAiUsageLog(supabaseUrl, serviceRoleKey, {
      shopId: member.shop_id,
      userId: user.id,
      featureName,
      model,
      inputTokens: openaiPayload.usage?.prompt_tokens || 0,
      outputTokens: openaiPayload.usage?.completion_tokens || 0,
    });

    const content = openaiPayload.choices?.[0]?.message?.content || "{}";
    return NextResponse.json({ ok: true, shopId: member.shop_id, result: JSON.parse(content) });
  } catch (error) {
    console.error("management-ai-comment failed", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "AI経営判断に失敗しました。",
    }, { status: 400 });
  }
}
