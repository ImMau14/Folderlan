// Provides a structured API response format and builder for consistent JSON responses.
use actix_web::HttpResponse;
use serde::Serialize;

// Generic API response structure with optional fields
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

// Builder pattern implementation for constructing API responses
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
    // Creates a new builder instance with all fields empty
    pub fn new() -> Self {
        Self {
            message: None,
            data: None,
            token: None,
            exists: None,
        }
    }

    // Sets the response message
    pub fn message(mut self, msg: impl Into<String>) -> Self {
        self.message = Some(msg.into());
        self
    }

    // Sets the response data payload
    pub fn data(mut self, data: T) -> Self {
        self.data = Some(data);
        self
    }

    // Sets an authentication token
    pub fn token(mut self, token: impl Into<String>) -> Self {
        self.token = Some(token.into());
        self
    }

    // Sets existence flag for boolean checks
    pub fn exists(mut self, exists: bool) -> Self {
        self.exists = Some(exists);
        self
    }

    // --- Success responses (success: true) ---

    // 200 OK response
    pub fn ok(self) -> HttpResponse {
        HttpResponse::Ok().json(self.into_api(true))
    }

    // 201 Created response
    pub fn created(self) -> HttpResponse {
        HttpResponse::Created().json(self.into_api(true))
    }

    // 206 Partial Content response
    pub fn partial(self) -> HttpResponse {
        HttpResponse::PartialContent().json(self.into_api(true))
    }

    // --- Error responses (success: false) ---

    // 400 Bad Request response
    pub fn bad_request(self) -> HttpResponse {
        HttpResponse::BadRequest().json(self.into_api(false))
    }

    // 403 Forbidden response
    pub fn forbidden(self) -> HttpResponse {
        HttpResponse::Forbidden().json(self.into_api(false))
    }

    // 404 Not Found response
    pub fn not_found(self) -> HttpResponse {
        HttpResponse::NotFound().json(self.into_api(false))
    }

    // 500 Internal Server Error response
    pub fn internal(self) -> HttpResponse {
        HttpResponse::InternalServerError().json(self.into_api(false))
    }

    // 401 Unauthorized response
    pub fn unauthorized(self) -> HttpResponse {
        HttpResponse::Unauthorized().json(self.into_api(false))
    }

    // --- Helper methods ---

    // Converts builder into final ApiResponse struct
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
    // Creates a new builder instance
    pub fn builder() -> ApiResponseBuilder<T> {
        ApiResponseBuilder::new()
    }
}
