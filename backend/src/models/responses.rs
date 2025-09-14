use actix_web::HttpResponse;
use serde::Serialize;

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exists: Option<bool>,
}

pub struct ApiResponseBuilder<T: Serialize> {
    message: Option<String>,
    data: Option<T>,
    token: Option<String>,
    exists: Option<bool>,
}

impl<T: Serialize> Default for ApiResponseBuilder<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Serialize> ApiResponseBuilder<T> {
    pub fn new() -> Self {
        Self {
            message: None,
            data: None,
            token: None,
            exists: None,
        }
    }

    pub fn message(mut self, msg: impl Into<String>) -> Self {
        self.message = Some(msg.into());
        self
    }

    pub fn data(mut self, data: T) -> Self {
        self.data = Some(data);
        self
    }

    pub fn token(mut self, token: impl Into<String>) -> Self {
        self.token = Some(token.into());
        self
    }

    pub fn exists(mut self, exists: bool) -> Self {
        self.exists = Some(exists);
        self
    }

    // --- success: true ---

    pub fn ok(self) -> HttpResponse {
        HttpResponse::Ok().json(self.into_api(true))
    }

    pub fn created(self) -> HttpResponse {
        HttpResponse::Created().json(self.into_api(true))
    }

    pub fn partial(self) -> HttpResponse {
        HttpResponse::PartialContent().json(self.into_api(true))
    }

    // --- success: false ---

    pub fn bad_request(self) -> HttpResponse {
        HttpResponse::BadRequest().json(self.into_api(false))
    }

    pub fn forbidden(self) -> HttpResponse {
        HttpResponse::Forbidden().json(self.into_api(false))
    }

    pub fn not_found(self) -> HttpResponse {
        HttpResponse::NotFound().json(self.into_api(false))
    }

    pub fn internal(self) -> HttpResponse {
        HttpResponse::InternalServerError().json(self.into_api(false))
    }

    pub fn unauthorized(self) -> HttpResponse {
        HttpResponse::Unauthorized().json(self.into_api(false))
    }

    // --- helpers ---

    pub fn into_api(self, success: bool) -> ApiResponse<T> {
        ApiResponse {
            success,
            message: self.message,
            data: self.data,
            token: self.token,
            exists: self.exists,
        }
    }
}

impl<T: Serialize> ApiResponse<T> {
    pub fn builder() -> ApiResponseBuilder<T> {
        ApiResponseBuilder::new()
    }
}
